begin;
-- El paciente recibe una proyección de sus datos, no los catálogos operativos.
do $$ declare t text; begin
 foreach t in array array['perfiles_medicos','perfiles_enfermeros','clinicas','camas','habitaciones','catalogo_analisis'] loop
  execute format('drop policy if exists catalogo_personal on public.%I',t);
  execute format('create policy catalogo_personal on public.%I for select to authenticated using(public.clinica_rol() in (''admin'',''medico'',''enfermero'',''recepcionista''))',t);
 end loop;
end $$;

create function public.clinica_portal_paciente() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p perfiles_pacientes; u usuarios; citas_propias jsonb; consultas_propias jsonb; resultados_propios jsonb; soporte_propio jsonb;
begin
 if clinica_rol() is distinct from 'paciente' then raise exception 'Esta sección es exclusiva del paciente' using errcode='42501'; end if;
 select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 select * into p from perfiles_pacientes where usuario_id=u.id and esta_activo;
 if not found then raise exception 'No se encontró un perfil de paciente activo' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.inicio desc),'[]'::jsonb) into citas_propias from (
  select c.id,c.inicio,c.fin,c.estado,c.motivo,um.nombre_completo medico,m.especialidad,
   cl.nombre clinica,cl.direccion,cl.telefono telefono_clinica
  from citas c join perfiles_medicos m on m.id=c.medico_id join usuarios um on um.id=m.usuario_id join clinicas cl on cl.id=c.clinica_id
  where c.paciente_id=p.id order by c.inicio desc limit 100
 ) q;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.fecha desc),'[]'::jsonb) into consultas_propias from (
  select e.id,e.creado_en fecha,e.diagnostico,e.receta,um.nombre_completo medico,c.motivo
  from expedientes e join citas c on c.id=e.cita_id join perfiles_medicos m on m.id=c.medico_id join usuarios um on um.id=m.usuario_id
  where c.paciente_id=p.id order by e.creado_en desc limit 50
 ) q;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.fecha desc),'[]'::jsonb) into resultados_propios from (
  select s.id,ca.nombre estudio,coalesce(s.fecha_resultado,s.fecha_solicitud) fecha,s.estado_analisis estado,
   case when s.estado_analisis='completado' then s.resultado end resultado,
   (s.estado_analisis='completado' and nullif(s.archivo_resultado,'') is not null) con_documento
  from solicitudes_analisis s join catalogo_analisis ca on ca.id=s.analisis_id join ordenes_medicas o on o.id=s.orden_medica_id
   join episodios_medicos e on e.id=o.episodio_id join internaciones i on i.id=e.internacion_id
  where i.paciente_id=p.id order by coalesce(s.fecha_resultado,s.fecha_solicitud) desc limit 50
 ) q;
 select jsonb_build_object('nombre',cl.nombre,'telefono',cl.telefono,'correo_contacto',cl.correo_contacto) into soporte_propio from citas c join clinicas cl on cl.id=c.clinica_id where c.paciente_id=p.id order by (c.fin>now() and c.estado in('pendiente','confirmada')) desc,c.inicio desc limit 1;
 return jsonb_build_object('perfil',jsonb_build_object('id',p.id,'nombre',u.nombre_completo,'correo',u.correo,'telefono',u.telefono,'fecha_nacimiento',p.fecha_nacimiento,'genero',p.genero,'contacto_emergencia',p.nombre_contacto_emergencia,'telefono_emergencia',p.telefono_emergencia),'citas',citas_propias,'consultas',consultas_propias,'resultados',resultados_propios,'soporte',soporte_propio);
end $$;
revoke all on function public.clinica_portal_paciente() from public,anon;
grant execute on function public.clinica_portal_paciente() to authenticated;

-- Apertura de documentos propios: lectura auditada; subir sigue reservado al personal.
create or replace function public.clinica_auditar_documento(p_tipo text,p_id bigint,p_accion text,p_nombre text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare permitido boolean:=false;
begin
 if p_accion not in ('ADJUNTAR_DOCUMENTO','ABRIR_DOCUMENTO') or length(coalesce(p_nombre,''))>200 then raise exception 'Evento inválido'; end if;
 if clinica_rol()='paciente' then
  if p_accion<>'ABRIR_DOCUMENTO' then raise exception 'El paciente solo puede consultar sus documentos' using errcode='42501'; end if;
  if p_tipo='expedientes' then permitido:=clinica_expediente(p_id);
  elsif p_tipo='laboratorio' then select clinica_orden(orden_medica_id) and estado_analisis='completado' into permitido from solicitudes_analisis where id=p_id; end if;
 elsif p_tipo='expedientes' then permitido:=clinica_rol() in ('admin','medico','recepcionista') and clinica_expediente(p_id);
 elsif p_tipo='ordenes' then permitido:=clinica_rol() in ('admin','medico','enfermero') and clinica_orden(p_id);
 elsif p_tipo='laboratorio' then select clinica_rol() in ('admin','medico','enfermero') and clinica_orden(orden_medica_id) into permitido from solicitudes_analisis where id=p_id; end if;
 if permitido is distinct from true then raise exception 'Documento sin acceso' using errcode='42501'; end if;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(auth.uid(),(select nombre_completo from usuarios where auth_user_id=auth.uid()),p_tipo,p_id::text,p_accion,jsonb_build_object('documento',p_nombre));
end $$;

-- solicitudes_analisis usa estado_analisis; las otras tablas usan estado.
create or replace function public.clinica_avisar_atencion() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_paciente bigint; v_medico bigint; v_titulo text; v_clave text;
begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
 if tg_table_name='internaciones' then
  if tg_op='UPDATE' and new.estado=old.estado and new.medico_responsable_id=old.medico_responsable_id and new.cama_id=old.cama_id then return new; end if;
  v_paciente:=new.paciente_id; v_medico:=new.medico_responsable_id;
  v_titulo:=case when new.estado='alta' then 'Alta hospitalaria registrada' when tg_op='INSERT' then 'Ingreso hospitalario registrado' else 'Hospitalización actualizada' end;
 elsif tg_table_name='ordenes_medicas' then
  if tg_op='UPDATE' and new.estado=old.estado then return new; end if;
  select i.paciente_id,i.medico_responsable_id into v_paciente,v_medico from episodios_medicos e join internaciones i on i.id=e.internacion_id where e.id=new.episodio_id;
  v_titulo:=case when tg_op='INSERT' then 'Nueva orden médica' else 'Orden médica actualizada' end;
 else
  if tg_op='UPDATE' and new.estado_analisis=old.estado_analisis then return new; end if;
  select i.paciente_id,i.medico_responsable_id into v_paciente,v_medico from ordenes_medicas o join episodios_medicos e on e.id=o.episodio_id join internaciones i on i.id=e.internacion_id where o.id=new.orden_medica_id;
  v_titulo:=case when new.estado_analisis='completado' then 'Resultado de laboratorio disponible' else 'Solicitud de laboratorio actualizada' end;
 end if;
 v_clave:=tg_table_name||':'||new.id||':'||gen_random_uuid();
 insert into notificaciones(usuario_id,tipo,titulo,mensaje,clave)
 select u.id,tg_table_name,v_titulo,'Hay una actualización en la atención del paciente. Consulta los detalles en tu cuenta de Clínica Nova.',v_clave from usuarios u where u.esta_activo and (u.rol in('admin','enfermero') or u.id=(select usuario_id from perfiles_medicos where id=v_medico) or u.id=(select usuario_id from perfiles_pacientes where id=v_paciente));
 return new;
end $$;
create or replace function public.clinica_version() returns integer language sql stable as $$select 22$$;
notify pgrst,'reload schema';
commit;
