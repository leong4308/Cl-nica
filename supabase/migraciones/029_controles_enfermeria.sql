begin;
-- Conserva la definición histórica y cierra su ejecución directa.
alter function public.clinica_enfermeria_operar(text,jsonb,uuid) rename to clinica_enfermeria_operar_v28;
revoke all on function public.clinica_enfermeria_operar_v28(text,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.clinica_enfermeria_operar(p_accion text,p_datos jsonb,p_clave uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios; p bigint; enf bigint; r enfermeria_registros; original enfermeria_registros; t enfermeria_tareas; o ordenes_medicas;
 i internaciones; mov enfermeria_movimientos; v_tipo text; v_datos jsonb; observado timestamptz; id_nuevo bigint; resultado jsonb;
 autor_medico bigint; parametro text; numero numeric; conteo integer; inicio timestamptz; fin timestamptz;
begin
 perform clinica_requerir_sesion();
 select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if u.rol not in('admin','medico','enfermero') or u.id is null then raise exception 'Sin acceso al seguimiento de enfermería' using errcode='42501'; end if;
 if p_clave is null or jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>20000 then raise exception 'Solicitud inválida'; end if;
 perform pg_advisory_xact_lock(37203,0);
 if p_accion in('autorizar','movimiento') then perform pg_advisory_xact_lock(37202,0); end if;
 -- Una respuesta perdida se puede repetir sin duplicar el registro.
 select * into r from enfermeria_registros where autor=u.id and clave=p_clave;
 if found then
  if p_accion<>r.datos->>'operacion' or p_datos is distinct from r.datos->'solicitud' then raise exception 'La solicitud ya fue utilizada' using errcode='40001'; end if;
  if not clinica_paciente(r.paciente_id) then raise exception 'El paciente ya no está asignado a tu atención' using errcode='42501'; end if;
  return jsonb_build_object('id',r.id,'mensaje','El registro ya quedó guardado.');
 end if;
 p:=(p_datos->>'pacienteId')::bigint;
 if p_accion='asignar' then
  if u.rol<>'admin' then raise exception 'Solo administración asigna turnos' using errcode='42501'; end if;
  enf:=(p_datos->>'enfermeroId')::bigint; inicio:=(p_datos->>'inicio')::timestamptz; fin:=(p_datos->>'fin')::timestamptz;
  if not exists(select 1 from perfiles_pacientes pp join usuarios up on up.id=pp.usuario_id and up.esta_activo where pp.id=p and pp.esta_activo)
   or not exists(select 1 from perfiles_enfermeros e join usuarios ue on ue.id=e.usuario_id and ue.esta_activo and ue.rol='enfermero' where e.id=enf and e.esta_activo) then raise exception 'Elige un paciente y un enfermero activos'; end if;
  if (exists(select 1 from citas where paciente_id=p) or exists(select 1 from internaciones where paciente_id=p)) and not exists(
   select 1 from perfiles_enfermeros ee where ee.id=enf and (ee.clinica_id in(select clinica_id from citas where paciente_id=p) or ee.clinica_id in(select clinica_id from internaciones where paciente_id=p))
  ) then raise exception 'El enfermero debe pertenecer a una clínica que atienda al paciente'; end if;
  if inicio is null or fin is null or fin<=clock_timestamp() or fin<=inicio or fin>inicio+interval '24 hours' or length(trim(coalesce(p_datos->>'area',''))) not between 1 and 120 then raise exception 'Indica el área y un turno de hasta 24 horas'; end if;
  select id into id_nuevo from enfermeria_turnos where clave=p_clave and autor=u.id and enfermero_id=enf and paciente_id=p and enfermeria_turnos.inicio=(p_datos->>'inicio')::timestamptz and enfermeria_turnos.fin=(p_datos->>'fin')::timestamptz and area=trim(p_datos->>'area');
  if found then return jsonb_build_object('id',id_nuevo,'mensaje','El turno ya quedó asignado.'); end if;
  if exists(select 1 from enfermeria_turnos where enfermero_id=enf and paciente_id=p and not cancelado and tstzrange((p_datos->>'inicio')::timestamptz,(p_datos->>'fin')::timestamptz,'[)') && tstzrange(enfermeria_turnos.inicio,enfermeria_turnos.fin,'[)')) then raise exception 'Ese paciente ya está asignado al enfermero en ese intervalo' using errcode='23P01'; end if;
  insert into enfermeria_turnos(enfermero_id,paciente_id,inicio,fin,area,autor,clave) values(enf,p,inicio,fin,trim(p_datos->>'area'),u.id,p_clave) returning id into id_nuevo;
  perform clinica_avisar_enfermeria(p,'Nuevo turno asignado','Tienes un paciente asignado. Revisa Mi turno para consultar el área y las tareas.','turno:'||id_nuevo,(select usuario_id from perfiles_enfermeros where id=enf));
  return jsonb_build_object('id',id_nuevo,'mensaje','Paciente asignado al turno.');
 end if;
 if p is null or not clinica_paciente(p) then raise exception 'El paciente no está asignado a tu atención o terminó tu turno' using errcode='42501'; end if;
 enf:=clinica_enfermero();
 if u.rol='enfermero' and enf is null then raise exception 'Tu perfil de enfermería no está activo' using errcode='42501'; end if;
 v_datos:=p_datos; v_tipo:=p_accion;
 observado:=coalesce((p_datos->>'observadoEn')::timestamptz,clock_timestamp());
 if observado>clock_timestamp()+interval '1 minute' or observado<clock_timestamp()-interval '48 hours' then raise exception 'La hora del registro debe estar dentro de las últimas 48 horas'; end if;
 if p_accion='retirar_turno' then
  if u.rol<>'admin' then raise exception 'Solo administración retira asignaciones' using errcode='42501'; end if;
  if length(trim(coalesce(p_datos->>'texto','')))=0 then raise exception 'Indica el motivo para retirar la asignación'; end if;
  update enfermeria_turnos set cancelado=true where id=(p_datos->>'turnoId')::bigint and paciente_id=p and not cancelado;
  if not found then raise exception 'El turno ya no está disponible' using errcode='40001'; end if;
  v_tipo:='nota';
 elsif p_accion='contacto' then
  if length(coalesce(p_datos->>'telefono',''))>20 or length(coalesce(p_datos->>'contacto',''))>200 or length(coalesce(p_datos->>'telefonoEmergencia',''))>20 then raise exception 'Revisa los datos de contacto'; end if;
  update usuarios set telefono=nullif(trim(p_datos->>'telefono'),'') where id=(select usuario_id from perfiles_pacientes where id=p);
  update perfiles_pacientes set nombre_contacto_emergencia=nullif(trim(p_datos->>'contacto'),''),telefono_emergencia=nullif(trim(p_datos->>'telefonoEmergencia'),'') where id=p;
  v_tipo:='nota'; v_datos:=jsonb_build_object('texto','Se actualizaron los datos de contacto del paciente.');
 elsif p_accion in('nota','incidencia','entrega','correccion') then
  if length(trim(coalesce(p_datos->>'texto',''))) not between 1 and 8000 then raise exception 'Escribe una nota de hasta 8000 caracteres'; end if;
  if p_accion='correccion' then
   select * into original from enfermeria_registros where id=(p_datos->>'corrigeId')::bigint and paciente_id=p;
   if not found or original.tipo not in('nota','signos','incidencia','correccion') or original.autor<>u.id and u.rol<>'admin' then raise exception 'Solo puedes corregir tus propios registros mediante una nota adicional' using errcode='42501'; end if;
  elsif p_accion='entrega' then
   if u.rol<>'enfermero' or not exists(select 1 from enfermeria_turnos tt join perfiles_enfermeros ee on ee.id=tt.enfermero_id and ee.esta_activo join usuarios ue on ue.id=ee.usuario_id and ue.esta_activo and ue.rol='enfermero' where tt.enfermero_id=(p_datos->>'destinatario')::bigint and tt.paciente_id=p and not tt.cancelado and tt.fin>clock_timestamp() and tt.inicio<clock_timestamp()+interval '24 hours' and tt.enfermero_id<>enf) then raise exception 'Selecciona el enfermero con un turno siguiente asignado a este paciente'; end if;
  end if;
 elsif p_accion='signos' then
  if jsonb_typeof(p_datos->'valores') is distinct from 'object' or p_datos->'valores'='{}' then raise exception 'Registra al menos un signo vital'; end if;
  for parametro in select jsonb_object_keys(p_datos->'valores') loop
   if parametro not in('sistolica','diastolica','pulso','temperatura','saturacion','peso','glucosa') then raise exception 'Signo vital no admitido'; end if;
   if jsonb_typeof(p_datos->'valores'->parametro)<>'number' then raise exception 'Los signos vitales deben ser numéricos'; end if;
   numero:=(p_datos->'valores'->>parametro)::numeric;
   if numero<0 or numero>10000 or parametro='saturacion' and numero>100 then raise exception 'Revisa el valor y la unidad del signo vital'; end if;
  end loop;
 elsif p_accion='programar' then
  if u.rol not in('admin','medico') then raise exception 'Solo el médico o administración programan tareas autorizadas' using errcode='42501'; end if;
  v_tipo:=p_datos->>'tipo'; inicio:=(p_datos->>'programada')::timestamptz;
  if v_tipo is null or v_tipo not in('medicamento','control','cuidado') or inicio is null or inicio<clock_timestamp()-interval '1 minute' or inicio>clock_timestamp()+interval '30 days' or length(trim(coalesce(p_datos->>'titulo',''))) not between 1 and 200 then raise exception 'Revisa el tipo, la tarea y su fecha'; end if;
  if v_tipo='medicamento' then
   if u.rol<>'medico' then raise exception 'Solo el médico programa dosis de medicamentos' using errcode='42501'; end if;
   select om.* into o from ordenes_medicas om join episodios_medicos ep on ep.id=om.episodio_id join internaciones ii on ii.id=ep.internacion_id where om.id=(p_datos->>'ordenId')::bigint and ii.paciente_id=p and ii.estado='activa' and om.tipo_orden='medicamento' and om.estado::text in('prescrita','en proceso');
   if not found or length(trim(coalesce(p_datos->>'dosis',''))) not between 1 and 200 or length(trim(coalesce(p_datos->>'via',''))) not between 1 and 100 then raise exception 'Selecciona una prescripción activa e indica la dosis y vía autorizadas'; end if;
  end if;
  if v_tipo='control' and coalesce(p_datos->>'parametro','')<>'' then
   if u.rol<>'medico' then raise exception 'Los límites de alerta los configura el médico' using errcode='42501'; end if;
   if p_datos->>'parametro' not in('sistolica','diastolica','pulso','temperatura','saturacion','peso','glucosa') or (p_datos->>'minimo')::numeric is null or (p_datos->>'maximo')::numeric is null or (p_datos->>'minimo')::numeric>=(p_datos->>'maximo')::numeric then raise exception 'Indica el parámetro y los límites de alerta'; end if;
  end if;
  select id into id_nuevo from enfermeria_tareas where clave=p_clave and autor=u.id and enfermeria_tareas.datos=p_datos;
  if found then return jsonb_build_object('id',id_nuevo,'mensaje','La tarea ya quedó programada.'); end if;
  insert into enfermeria_tareas(paciente_id,orden_id,orden_version,tipo,titulo,datos,programada,autor,clave)
   values(p,o.id,clinica_version_orden(o.id),v_tipo,trim(p_datos->>'titulo'),p_datos,inicio,u.id,p_clave) returning id into id_nuevo;
  return jsonb_build_object('id',id_nuevo,'mensaje','Tarea programada.');
 elsif p_accion='cumplir' then
  if u.rol<>'enfermero' then raise exception 'El cumplimiento se registra con la cuenta del enfermero que realizó la atención' using errcode='42501'; end if;
  select * into t from enfermeria_tareas where id=(p_datos->>'tareaId')::bigint and paciente_id=p for update;
  if not found or t.estado<>'pendiente' then raise exception 'La tarea ya fue registrada o no está disponible' using errcode='40001'; end if;
  if t.programada>clock_timestamp() then raise exception 'Aún no llega la hora programada. Revisa la tarea antes de registrarla'; end if;
  if observado<t.programada then raise exception 'La hora observada no puede ser anterior a la tarea programada'; end if;
  if (p_datos->>'confirmado')::boolean is distinct from true or p_datos->>'estado' is null or p_datos->>'estado' not in('realizada','omitida') then raise exception 'Confirma al paciente y la indicación antes de registrar'; end if;
  if p_datos->>'estado'='omitida' and length(trim(coalesce(p_datos->>'texto','')))=0 then raise exception 'Indica por qué no se realizó'; end if;
  if t.tipo='medicamento' then
   select * into o from ordenes_medicas where id=t.orden_id for share;
   if o.id is null or clinica_version_orden(o.id) is distinct from t.orden_version or o.estado::text not in('prescrita','en proceso') then raise exception 'La prescripción cambió o ya no está activa. Pide al médico revisar y reprogramar la dosis' using errcode='40001'; end if;
   if not exists(select 1 from episodios_medicos ep join internaciones ii on ii.id=ep.internacion_id where ep.id=o.episodio_id and ii.estado='activa') then raise exception 'El paciente ya no tiene esa hospitalización activa'; end if;
  end if;
  if t.tipo='control' and p_datos->>'estado'='realizada' and not exists(select 1 from enfermeria_registros rr where rr.paciente_id=p and rr.tipo='signos' and rr.observado_en>=t.programada and rr.creado_en>=t.creado_en and (coalesce(t.datos->>'parametro','')='' or rr.datos->'valores' ? (t.datos->>'parametro'))) then raise exception 'Registra primero los signos vitales correspondientes al control'; end if;
  update enfermeria_tareas set estado=p_datos->>'estado' where id=t.id;
  v_datos:=p_datos||jsonb_build_object('indicacion',t.datos,'titulo',t.titulo,'programada',t.programada); v_tipo:=case when t.tipo='medicamento' then 'medicamento' else 'cuidado' end;
 elsif p_accion='anular_tarea' then
  if u.rol not in('admin','medico') then raise exception 'Solo el prescriptor o administración puede anular tareas' using errcode='42501'; end if;
  select * into t from enfermeria_tareas where id=(p_datos->>'tareaId')::bigint and paciente_id=p for update;
  if not found or t.estado<>'pendiente' or length(trim(coalesce(p_datos->>'texto','')))=0 then raise exception 'Indica el motivo y selecciona una tarea pendiente'; end if;
  if t.tipo='medicamento' and u.rol<>'medico' then raise exception 'La dosis debe anularla un médico' using errcode='42501'; end if;
  update enfermeria_tareas set estado='anulada' where id=t.id; v_tipo:='nota';
 elsif p_accion='orden_estado' then
  if u.rol<>'enfermero' then raise exception 'Acción exclusiva de enfermería' using errcode='42501'; end if;
  select om.* into o from ordenes_medicas om join episodios_medicos ep on ep.id=om.episodio_id join internaciones ii on ii.id=ep.internacion_id where om.id=(p_datos->>'ordenId')::bigint and ii.paciente_id=p and ii.estado='activa' for update of om;
  if not found or o.tipo_orden='medicamento' or o.estado::text not in('prescrita','en proceso') or p_datos->>'estado' is null or p_datos->>'estado' not in('en proceso','completada') then raise exception 'Selecciona una indicación vigente de cuidado o procedimiento. Las dosis se registran por separado'; end if;
  if clinica_version_orden(o.id) is distinct from p_datos->>'version' then raise exception 'La indicación cambió; vuelve a consultarla' using errcode='40001'; end if;
  update ordenes_medicas set estado=(p_datos->>'estado')::estado_orden,fecha_ejecucion=case when p_datos->>'estado'='completada' then clock_timestamp() else fecha_ejecucion end where id=o.id;
  v_tipo:='cuidado';
 elsif p_accion='muestra' then
  if u.rol<>'enfermero' then raise exception 'Registra la muestra con tu cuenta de enfermería' using errcode='42501'; end if;
  if p_datos->>'etapa' is null or p_datos->>'etapa' not in('tomada','entregada') then raise exception 'Selecciona toma o entrega de muestra'; end if;
  if not exists(select 1 from solicitudes_analisis s join ordenes_medicas om on om.id=s.orden_medica_id join episodios_medicos ep on ep.id=om.episodio_id join internaciones ii on ii.id=ep.internacion_id where s.id=(p_datos->>'solicitudId')::bigint and ii.paciente_id=p and ii.estado='activa' and s.estado_analisis<>'completado') then raise exception 'El estudio no está pendiente o no corresponde al paciente'; end if;
  if exists(select 1 from enfermeria_registros where tipo='muestra' and datos->>'solicitudId'=p_datos->>'solicitudId' and datos->>'etapa'=p_datos->>'etapa') then raise exception 'Esta etapa de la muestra ya se registró' using errcode='40001'; end if;
  if p_datos->>'etapa'='entregada' and not exists(select 1 from solicitudes_analisis where id=(p_datos->>'solicitudId')::bigint and fecha_toma_muestra is not null) then raise exception 'Primero registra la toma de muestra'; end if;
  if p_datos->>'etapa'='tomada' and exists(select 1 from solicitudes_analisis where id=(p_datos->>'solicitudId')::bigint and fecha_toma_muestra is not null) then raise exception 'La toma de esta muestra ya quedó registrada' using errcode='40001'; end if;
  if p_datos->>'etapa'='tomada' then update solicitudes_analisis set fecha_toma_muestra=clock_timestamp(),enfermero_toma_id=enf where id=(p_datos->>'solicitudId')::bigint; end if;
 elsif p_accion='llegada' then
  if u.rol<>'enfermero' or not exists(select 1 from citas where id=(p_datos->>'citaId')::bigint and paciente_id=p and estado in('pendiente','confirmada') and (inicio at time zone 'America/Mexico_City')::date=(clock_timestamp() at time zone 'America/Mexico_City')::date) then raise exception 'La llegada solo se registra en una cita vigente del día'; end if;
  if exists(select 1 from enfermeria_registros where tipo='llegada' and datos->>'citaId'=p_datos->>'citaId') then raise exception 'La llegada ya está registrada' using errcode='40001'; end if;
 elsif p_accion='acusar' then
  select * into original from enfermeria_registros where id=(p_datos->>'registroId')::bigint and paciente_id=p;
  if not found or original.tipo not in('incidencia','entrega') or original.tipo='incidencia' and u.rol<>'medico' or original.tipo='entrega' and original.destinatario is distinct from enf then raise exception 'No puedes confirmar la recepción de este registro' using errcode='42501'; end if;
  if length(trim(coalesce(p_datos->>'texto',''))) not between 1 and 2000 then raise exception 'Escribe tu respuesta o confirmación'; end if;
  insert into enfermeria_acuses(registro_id,autor,respuesta) values(original.id,u.id,trim(p_datos->>'texto'));
  v_tipo:='recepcion';
 elsif p_accion='autorizar' then
  if u.rol<>'medico' then raise exception 'Solo un médico puede autorizar el alta o traslado' using errcode='42501'; end if;
  select * into i from internaciones where id=(p_datos->>'internacionId')::bigint and paciente_id=p and estado='activa' for update;
  if not found or p_datos->>'tipo' is null or p_datos->>'tipo' not in('alta','traslado') or length(trim(coalesce(p_datos->>'texto',''))) not between 1 and 8000 then raise exception 'Selecciona una estancia activa e indica la autorización'; end if;
  if (p_datos->>'version')::timestamptz is distinct from i.actualizado_en then raise exception 'La estancia cambió. Revisa el ingreso antes de autorizar' using errcode='40001'; end if;
  if p_datos->>'tipo'='traslado' and not exists(select 1 from camas cc join habitaciones hh on hh.id=cc.habitacion_id where cc.id=(p_datos->>'camaId')::bigint and hh.clinica_id=i.clinica_id and not cc.esta_ocupada) then raise exception 'Selecciona una cama libre de la misma clínica'; end if;
  update enfermeria_movimientos set anulado=true where internacion_id=i.id and ejecutado_en is null and not anulado;
  insert into enfermeria_movimientos(internacion_id,tipo,cama_id,version,indicacion,medico_id) values(i.id,p_datos->>'tipo',case when p_datos->>'tipo'='traslado' then (p_datos->>'camaId')::bigint end,i.actualizado_en,trim(p_datos->>'texto'),clinica_medico()) returning id into id_nuevo;
  v_tipo:='nota'; v_datos:=p_datos||jsonb_build_object('autorizacionId',id_nuevo);
 elsif p_accion='movimiento' then
  if u.rol<>'enfermero' then raise exception 'Registra la ejecución desde enfermería' using errcode='42501'; end if;
  select mm.* into mov from enfermeria_movimientos mm join internaciones ii on ii.id=mm.internacion_id where mm.id=(p_datos->>'autorizacionId')::bigint and ii.paciente_id=p for update of mm;
  if not found or mov.anulado or mov.ejecutado_en is not null then raise exception 'La autorización ya se utilizó o no está disponible' using errcode='40001'; end if;
  if (p_datos->>'confirmado')::boolean is distinct from true or length(trim(coalesce(p_datos->>'texto','')))=0 then raise exception 'Confirma el movimiento y escribe la nota de enfermería'; end if;
  select * into i from internaciones where id=mov.internacion_id for update;
  if i.estado<>'activa' or i.actualizado_en is distinct from mov.version then raise exception 'La estancia cambió; solicita una autorización actualizada' using errcode='40001'; end if;
  -- Función privada original: misma transacción de cama, ingreso y episodio.
  resultado:=clinica_hospital_v27(i.id,case when mov.tipo='alta' then jsonb_build_object('accion','alta','version',i.actualizado_en,'confirmado',true,'notaAlta',mov.indicacion||E'\nEnfermería: '||(p_datos->>'texto')) else jsonb_build_object('accion','editar','version',i.actualizado_en,'pacienteId',p,'medicoId',i.medico_responsable_id,'camaId',mov.cama_id,'motivo',i.motivo_ingreso,'diagnostico',i.diagnostico_ingreso,'notaCambio',mov.indicacion||E'\nEnfermería: '||(p_datos->>'texto')) end);
  update enfermeria_movimientos set ejecutado_en=clock_timestamp() where id=mov.id;
  v_tipo:=case when mov.tipo='alta' then 'salida' else 'traslado' end;
 else raise exception 'Operación de enfermería inválida'; end if;
 v_datos:=v_datos||jsonb_build_object('operacion',p_accion,'solicitud',p_datos);
 insert into enfermeria_registros(paciente_id,tipo,datos,autor,observado_en,corrige_id,tarea_id,destinatario,clave)
 values(p,v_tipo,v_datos,u.id,observado,original.id,case when p_accion='cumplir' then t.id end,case when p_accion='entrega' then (p_datos->>'destinatario')::bigint end,p_clave) returning * into r;
 if p_accion='incidencia' or p_accion='cumplir' and p_datos->>'estado'='omitida' then
  if p_accion='cumplir' then
   insert into enfermeria_registros(paciente_id,tipo,datos,autor,clave) values(p,'incidencia',jsonb_build_object('texto','Tarea no realizada: '||t.titulo||E'\nMotivo: '||(p_datos->>'texto'),'registroId',r.id),u.id,gen_random_uuid());
  end if;
  perform clinica_avisar_enfermeria(p,'Incidencia de enfermería','Hay una incidencia o tarea omitida de un paciente de tu atención. Revísala en Enfermería.','incidencia:'||r.id);
 elsif p_accion='entrega' then
  perform clinica_avisar_enfermeria(p,'Entrega de turno pendiente','Tienes una entrega de turno para revisar y confirmar al iniciar tu atención.','entrega:'||r.id,(select usuario_id from perfiles_enfermeros where id=r.destinatario));
 elsif p_accion='signos' then
  for t in select * from enfermeria_tareas where paciente_id=p and tipo='control' and estado='pendiente' and programada<=clock_timestamp() and datos->>'parametro' is not null loop
   parametro:=t.datos->>'parametro'; numero:=(p_datos->'valores'->>parametro)::numeric;
   if numero is not null and (numero<(t.datos->>'minimo')::numeric or numero>(t.datos->>'maximo')::numeric) then
    insert into enfermeria_registros(paciente_id,tipo,datos,autor,clave) values(p,'incidencia',jsonb_build_object('texto','Control fuera de los límites configurados por el médico: '||parametro,'signosId',r.id,'tareaId',t.id),u.id,gen_random_uuid()) returning id into id_nuevo;
    perform clinica_avisar_enfermeria(p,'Revisar control de enfermería','Una medición requiere revisión según los límites configurados por el médico. Consulta Enfermería.','control:'||id_nuevo);
   end if;
  end loop;
 end if;
 return jsonb_build_object('id',r.id,'mensaje','Registro guardado con fecha y responsable.');
end $$;
revoke all on function public.clinica_enfermeria_operar(text,jsonb,uuid) from public,anon;
grant execute on function public.clinica_enfermeria_operar(text,jsonb,uuid) to authenticated;
create or replace function public.clinica_version() returns integer language sql stable as $$select 29$$;
notify pgrst,'reload schema';
commit;
