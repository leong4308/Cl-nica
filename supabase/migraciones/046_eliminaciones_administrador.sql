begin;
create function clinica_admin_tabla_eliminacion(p_modulo text) returns text language sql immutable as $$
 select case p_modulo when 'Citas' then 'citas' when 'Pacientes' then 'perfiles_pacientes' when 'Médicos' then 'perfiles_medicos'
 when 'Expedientes' then 'expedientes' when 'Internación' then 'internaciones' when 'Órdenes médicas' then 'ordenes_medicas' when 'Laboratorio' then 'solicitudes_analisis' end
$$;
revoke all on function clinica_admin_tabla_eliminacion(text) from public,anon,authenticated,service_role;

create function clinica_admin_eliminacion_info(p_modulo text,p_id bigint) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;t text;fila jsonb;r record;condicion text;n bigint;referencias jsonb:='[]';nombre text;
begin
 perform clinica_requerir_sesion();select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if u.rol is distinct from 'admin' then raise exception 'Solo administración puede eliminar registros' using errcode='42501';end if;
 t:=clinica_admin_tabla_eliminacion(p_modulo);if t is null or p_id is null or p_id<=0 then raise exception 'Selecciona un registro válido' using errcode='23514';end if;
 execute format('select to_jsonb(x) from %I x where id=$1',t) into fila using p_id;
 if fila is null then raise exception 'El registro ya no existe' using errcode='P0002';end if;
 for r in select c.conrelid,c.conkey,c.confkey,cl.relname tabla from pg_constraint c join pg_class cl on cl.oid=c.conrelid join pg_namespace ns on ns.oid=cl.relnamespace where c.contype='f' and c.confrelid=format('public.%I',t)::regclass and ns.nspname='public' loop
  -- Los avisos y tokens caducan al retirar una cita; no se borran historias por cascada.
  if t='citas' and r.tabla in('notificaciones','cita_solicitudes_cambio','telegram_acciones_cita','telegram_reservas','reservas_paciente','recepcion_llegadas','recepcion_eventos') then continue;end if;
  select string_agg(format('to_jsonb(d)->%L = $1->%L',a.attname,b.attname),' and ') into condicion from unnest(r.conkey,r.confkey) k(a,b) join pg_attribute a on a.attrelid=r.conrelid and a.attnum=k.a join pg_attribute b on b.attrelid=format('public.%I',t)::regclass and b.attnum=k.b;
  execute format('select count(*) from public.%I d where %s',r.tabla,condicion) into n using fila;
  if n>0 then referencias:=referencias||jsonb_build_array(jsonb_build_object('tabla',r.tabla,'cantidad',n));end if;
 end loop;
 if t='internaciones' and fila->>'estado'='activa' then referencias:=referencias||jsonb_build_array(jsonb_build_object('tabla','ingreso activo: requiere alta médica','cantidad',1));end if;
 nombre:=case when t in('perfiles_pacientes','perfiles_medicos') then (select nombre_completo from usuarios where id=(fila->>'usuario_id')::bigint) else p_modulo||' #'||p_id end;
 return jsonb_build_object('id',p_id,'modulo',p_modulo,'nombre',nombre,'version',md5(fila::text),'puedeEliminar',jsonb_array_length(referencias)=0,'referencias',referencias);
end $$;
revoke all on function clinica_admin_eliminacion_info(text,bigint) from public,anon;
grant execute on function clinica_admin_eliminacion_info(text,bigint) to authenticated;

create function clinica_admin_eliminar(p_modulo text,p_id bigint,p_version text,p_motivo text,p_confirmar boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;t text;fila jsonb;info jsonb;cuenta bigint;cama bigint;
begin
 perform clinica_requerir_sesion();select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if u.rol is distinct from 'admin' then raise exception 'Solo administración puede eliminar registros' using errcode='42501';end if;
 if p_confirmar is distinct from true or p_motivo is null or length(trim(p_motivo)) not between 10 and 1000 then raise exception 'Confirma la advertencia e indica un motivo de 10 a 1000 caracteres' using errcode='23514';end if;
 t:=clinica_admin_tabla_eliminacion(p_modulo);if t is null or p_id is null or p_id<=0 then raise exception 'Selecciona un registro válido' using errcode='23514';end if;
 execute format('select to_jsonb(x) from %I x where id=$1 for update',t) into fila using p_id;
 if fila is null then raise exception 'El registro ya no existe' using errcode='P0002';end if;
 if p_version is distinct from md5(fila::text) then raise exception 'El registro cambió. Revísalo antes de eliminar' using errcode='40001';end if;
 info:=clinica_admin_eliminacion_info(p_modulo,p_id);
 if not(info->>'puedeEliminar')::boolean then raise exception 'El registro tiene información relacionada. No se eliminarán historias ni dependencias automáticamente' using errcode='23503';end if;
 perform set_config('clinica.borrado_admin','confirmado',true);
 if t='citas' then
  delete from recepcion_eventos where cita_id=p_id;delete from recepcion_llegadas where cita_id=p_id;
 end if;
 cuenta:=(fila->>'usuario_id')::bigint;cama:=(fila->>'cama_id')::bigint;
 execute format('delete from %I where id=$1',t) using p_id;
 if t='perfiles_pacientes' then update usuarios set esta_activo=false where id=cuenta and rol='paciente';
 elsif t='perfiles_medicos' and not exists(select 1 from perfiles_medicos where usuario_id=cuenta and esta_activo) then update usuarios set esta_activo=false where id=cuenta and rol='medico';end if;
 if t='internaciones' then update camas set esta_ocupada=exists(select 1 from internaciones where cama_id=cama and estado='activa') where id=cama;end if;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,anterior,nuevo) values(auth.uid(),u.nombre_completo,t,p_id::text,'ELIMINACION_ADMIN',fila,jsonb_build_object('motivo',trim(p_motivo),'confirmado',true));
 perform set_config('clinica.borrado_admin','',true);
 return jsonb_build_object('ok',true,'mensaje','Registro eliminado. La operación quedó registrada en el historial de cambios.');
end $$;
revoke all on function clinica_admin_eliminar(text,bigint,text,text,boolean) from public,anon;
grant execute on function clinica_admin_eliminar(text,bigint,text,text,boolean) to authenticated;

revoke delete on citas,perfiles_pacientes,perfiles_medicos,expedientes,internaciones,ordenes_medicas,solicitudes_analisis from authenticated;

-- La excepción de eliminación solo existe dentro de la RPC administrativa confirmada.
create or replace function clinica_nota_inmutable() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' and current_setting('clinica.borrado_admin',true)='confirmado' and clinica_rol()='admin' and clinica_sesion_activa() then return old;end if;
 if old.estado_nota='cerrada' then raise exception 'La nota está cerrada. Añade una corrección sin modificar el original' using errcode='42501';end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1;return new;end if;return old;
end $$;

create function clinica_admin_retirar_documento(p_tipo text,p_id bigint,p_archivo text,p_motivo text,p_version text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;s solicitudes_analisis;t text;
begin
 perform clinica_requerir_sesion();select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if u.rol is distinct from 'admin' then raise exception 'Solo administración puede eliminar documentos' using errcode='42501';end if;
 if p_motivo is null or length(trim(p_motivo)) not between 10 and 1000 or p_archivo is null or p_archivo !~* '^[a-zA-Z0-9._-]+\.pdf$' or strpos(p_archivo,'..')>0 then raise exception 'Confirma el documento e indica el motivo de eliminación' using errcode='23514';end if;
 if p_tipo='laboratorio' then
  select * into s from solicitudes_analisis where id=p_id for update;
  if s.id is null then raise exception 'Resultado no encontrado' using errcode='P0002';end if;
  if s.archivo_resultado is distinct from p_id||'/'||p_archivo or s.fecha_resultado is distinct from nullif(p_version,'')::timestamptz then raise exception 'El PDF o el resultado cambió. Actualiza antes de eliminar' using errcode='40001';end if;
  update solicitudes_analisis set archivo_resultado=null,fecha_resultado=clock_timestamp(),estado_analisis=case when nullif(trim(resultado),'') is null then 'en proceso' else estado_analisis end where id=p_id;
  t:='solicitudes_analisis';
 elsif p_tipo='expedientes' then
  if not exists(select 1 from expedientes where id=p_id) then raise exception 'Expediente no encontrado' using errcode='P0002';end if;t:='expedientes';
 elsif p_tipo='ordenes' then
  if not exists(select 1 from ordenes_medicas where id=p_id) then raise exception 'Orden no encontrada' using errcode='P0002';end if;t:='ordenes_medicas';
 else raise exception 'Tipo de documento inválido' using errcode='23514';end if;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(auth.uid(),u.nombre_completo,t,p_id::text,'ELIMINAR_DOCUMENTO',jsonb_build_object('archivo',p_archivo,'motivo',trim(p_motivo),'copia_privada',true));
 return jsonb_build_object('ok',true);
end $$;
revoke all on function clinica_admin_retirar_documento(text,bigint,text,text,text) from public,anon;
grant execute on function clinica_admin_retirar_documento(text,bigint,text,text,text) to authenticated;
create or replace function clinica_version() returns integer language sql stable as $$select 46$$;
notify pgrst,'reload schema';
commit;
