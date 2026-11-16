begin;
-- La muestra conserva el ámbito del paciente asignado, también cuando la orden nació en consulta.
alter function public.clinica_enfermeria_operar(text,jsonb,uuid) rename to clinica_enfermeria_operar_v39;
revoke all on function clinica_enfermeria_operar_v39(text,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.clinica_enfermeria_operar(p_accion text,p_datos jsonb,p_clave uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;p bigint;enf bigint;r enfermeria_registros;s solicitudes_analisis;observado timestamptz;
begin
 if p_accion is distinct from 'muestra' then return clinica_enfermeria_operar_v39(p_accion,p_datos,p_clave);end if;
 perform clinica_requerir_sesion();
 select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if u.id is null or u.rol<>'enfermero' then raise exception 'Registra la muestra con tu cuenta de enfermería' using errcode='42501';end if;
 if p_clave is null or jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>20000 then raise exception 'Solicitud inválida';end if;
 if exists(select 1 from jsonb_object_keys(p_datos) k where k not in('pacienteId','solicitudId','etapa','texto','observadoEn')) then raise exception 'El seguimiento de muestra no modifica resultados ni indicaciones' using errcode='42501';end if;
 perform pg_advisory_xact_lock(37203,0);
 select * into r from enfermeria_registros where autor=u.id and clave=p_clave;
 if found then
  if r.datos->>'operacion' is distinct from p_accion or r.datos->'solicitud' is distinct from p_datos then raise exception 'La solicitud ya fue utilizada para otros datos' using errcode='PT409';end if;
  if not clinica_paciente(r.paciente_id) then raise exception 'El paciente ya no está asignado a tu atención' using errcode='42501';end if;
  return jsonb_build_object('id',r.id,'mensaje','El registro ya quedó guardado.');
 end if;
 p:=(p_datos->>'pacienteId')::bigint;enf:=clinica_enfermero();
 if p is null or enf is null or not clinica_paciente(p) then raise exception 'El paciente no está asignado a tu atención o terminó tu turno' using errcode='42501';end if;
 if p_datos->>'etapa' is null or p_datos->>'etapa' not in('tomada','entregada') then raise exception 'Selecciona toma o entrega de muestra';end if;
 observado:=coalesce(nullif(p_datos->>'observadoEn','')::timestamptz,clock_timestamp());
 if observado>clock_timestamp()+interval '1 minute' or observado<clock_timestamp()-interval '48 hours' or length(coalesce(p_datos->>'texto',''))>8000 then raise exception 'Revisa la hora y las observaciones de la muestra';end if;
 select sa.* into s from solicitudes_analisis sa join ordenes_medicas o on o.id=sa.orden_medica_id
 join episodios_medicos ep on ep.id=o.episodio_id left join internaciones i on i.id=ep.internacion_id left join citas c on c.id=ep.cita_id
 where sa.id=(p_datos->>'solicitudId')::bigint and coalesce(i.paciente_id,c.paciente_id)=p and o.estado::text<>'cancelada'
 and sa.estado_analisis not in('completado','cancelado','cancelada')
 and (i.id is not null and i.estado='activa' or c.id is not null and c.estado in('pendiente','confirmada','atendida')) for update of sa,o;
 if s.id is null then raise exception 'El estudio no está pendiente o no corresponde al paciente';end if;
 if exists(select 1 from enfermeria_registros where tipo='muestra' and datos->>'solicitudId'=s.id::text and datos->>'etapa'=p_datos->>'etapa') then raise exception 'Esta etapa de la muestra ya se registró' using errcode='PT409';end if;
 if p_datos->>'etapa'='entregada' and s.fecha_toma_muestra is null then raise exception 'Primero registra la toma de muestra';end if;
 if p_datos->>'etapa'='tomada' then
  if s.fecha_toma_muestra is not null then raise exception 'La toma de esta muestra ya quedó registrada' using errcode='PT409';end if;
  update solicitudes_analisis set fecha_toma_muestra=clock_timestamp(),enfermero_toma_id=enf where id=s.id;
 end if;
 insert into enfermeria_registros(paciente_id,tipo,datos,autor,observado_en,clave)
 values(p,'muestra',p_datos||jsonb_build_object('operacion',p_accion,'solicitud',p_datos),u.id,observado,p_clave) returning * into r;
 return jsonb_build_object('id',r.id,'mensaje','Seguimiento de muestra guardado con fecha y responsable.');
end $$;
revoke all on function clinica_enfermeria_operar(text,jsonb,uuid) from public,anon;
grant execute on function clinica_enfermeria_operar(text,jsonb,uuid) to authenticated;

alter function public.clinica_enfermeria_panel() rename to clinica_enfermeria_panel_v39;
revoke all on function clinica_enfermeria_panel_v39() from public,anon,authenticated,service_role;
create function public.clinica_enfermeria_panel() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r jsonb;ids bigint[];
begin
 r:=clinica_enfermeria_panel_v39();
 select array_agg((x->>'id')::bigint) into ids from jsonb_array_elements(r->'pacientes') x;
 return r||jsonb_build_object('muestras',coalesce((select jsonb_agg(to_jsonb(q) order by q.id desc) from(
  select s.id,coalesce(i.paciente_id,c.paciente_id) paciente_id,ca.nombre estudio,s.fecha_toma_muestra,s.estado_analisis,
   case when s.estado_analisis='completado' then s.resultado end resultado,
   (s.estado_analisis='completado' and nullif(s.archivo_resultado,'') is not null) con_documento,
   (select max(rr.creado_en) from enfermeria_registros rr where rr.paciente_id=coalesce(i.paciente_id,c.paciente_id) and rr.tipo='muestra' and rr.datos->>'solicitudId'=s.id::text and rr.datos->>'etapa'='entregada') fecha_entrega_muestra
  from solicitudes_analisis s join catalogo_analisis ca on ca.id=s.analisis_id join ordenes_medicas o on o.id=s.orden_medica_id
  join episodios_medicos ep on ep.id=o.episodio_id left join internaciones i on i.id=ep.internacion_id left join citas c on c.id=ep.cita_id
  where coalesce(i.paciente_id,c.paciente_id)=any(ids) and o.estado::text<>'cancelada'
   and (i.id is not null and i.estado='activa' or c.id is not null and c.estado in('pendiente','confirmada','atendida'))
 )q),'[]'::jsonb));
end $$;
revoke all on function clinica_enfermeria_panel() from public,anon;
grant execute on function clinica_enfermeria_panel() to authenticated;
create or replace function public.clinica_version() returns integer language sql stable as $$select 40$$;
notify pgrst,'reload schema';
commit;
