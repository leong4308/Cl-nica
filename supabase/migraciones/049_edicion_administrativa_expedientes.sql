begin;
-- La edición de una nota cerrada se limita a la operación administrativa auditada.
create or replace function clinica_nota_inmutable() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' and current_setting('clinica.borrado_admin',true)='confirmado' and clinica_rol()='admin' and clinica_sesion_activa() then return old;end if;
 if old.estado_nota='cerrada' then
  if tg_op<>'UPDATE' or current_setting('clinica.edicion_nota_admin',true) is distinct from 'confirmado' or clinica_rol() is distinct from 'admin' or not clinica_sesion_activa() then
   raise exception 'La nota está cerrada. Añade una aclaración o solicita una edición administrativa' using errcode='42501';
  end if;
  if new.id is distinct from old.id or new.cita_id is distinct from old.cita_id or new.autor_medico_id is distinct from old.autor_medico_id or new.estado_nota is distinct from old.estado_nota or new.cerrada_en is distinct from old.cerrada_en or new.cerrada_por is distinct from old.cerrada_por or new.creado_en is distinct from old.creado_en then
   raise exception 'La edición conserva la identidad, el autor y el cierre del expediente' using errcode='42501';
  end if;
 end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1;return new;end if;return old;
end $$;

create function clinica_admin_editar_nota(p_datos jsonb,p_clave uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;c citas;e expedientes;antes jsonb;d jsonb;limpio jsonb:='{}';r jsonb;campo text;v_receta text;solicitud jsonb;anterior medico_operaciones;respuesta jsonb;
begin
 perform clinica_requerir_sesion();
 if clinica_rol() is distinct from 'admin' then raise exception 'La edición administrativa requiere una cuenta de administrador' using errcode='42501';end if;
 select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if p_clave is null or jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>50000 or coalesce(p_datos->>'citaId','')!~'^[1-9][0-9]{0,15}$' then raise exception 'Solicitud de edición inválida' using errcode='23514';end if;
 perform pg_advisory_xact_lock(37205,0);
 solicitud:=jsonb_build_object('accion','editar_admin','datos',p_datos);
 select * into anterior from medico_operaciones where autor=u.id and clave=p_clave;
 if found then
  if anterior.solicitud is distinct from solicitud then raise exception 'La solicitud ya fue utilizada para otros cambios' using errcode='40001';end if;
  return anterior.resultado;
 end if;
 select * into c from citas where id=(p_datos->>'citaId')::bigint for update;
 select * into e from expedientes where cita_id=c.id for update;
 if c.id is null or e.id is null then raise exception 'Expediente no encontrado' using errcode='P0002';end if;
 if p_datos->>'version' is distinct from clinica_consulta_version(c.id) then raise exception 'El expediente cambió en otra ventana. Revisa la versión actual antes de guardar; tus cambios se conservan' using errcode='40001';end if;
 d:=p_datos->'contenido';
 if jsonb_typeof(d) is distinct from 'object' then raise exception 'Revisa el contenido del expediente' using errcode='23514';end if;
 foreach campo in array array['subjetivo','objetivo','diagnostico','plan','pronostico','seguimiento','recetaLibre'] loop
  if jsonb_typeof(d->campo) is distinct from 'string' or length(d->>campo)>8000 then raise exception 'Revisa los campos del expediente; cada uno admite hasta 8000 caracteres' using errcode='23514';end if;
  limpio:=limpio||jsonb_build_object(campo,d->>campo);
 end loop;
 if length(trim(d->>'diagnostico'))=0 then raise exception 'El diagnóstico es obligatorio' using errcode='23514';end if;
 if jsonb_typeof(d->'medicamentos') is distinct from 'array' or jsonb_array_length(d->'medicamentos')>30 then raise exception 'Revisa los medicamentos del expediente' using errcode='23514';end if;
 v_receta:=d->>'recetaLibre';
 for r in select value from jsonb_array_elements(d->'medicamentos') loop
  if jsonb_typeof(r) is distinct from 'object' then raise exception 'Completa los datos de cada medicamento' using errcode='23514';end if;
  foreach campo in array array['nombre','dosis','via','frecuencia','duracion'] loop
   if jsonb_typeof(r->campo) is distinct from 'string' or length(trim(r->>campo)) not between 1 and (case when campo='via' then 120 else 200 end) then raise exception 'Completa nombre, dosis, vía, frecuencia y duración de cada medicamento' using errcode='23514';end if;
  end loop;
  v_receta:=concat_ws(E'\n',nullif(v_receta,''),concat(r->>'nombre',' · ',r->>'dosis',' · ',r->>'via',' · ',r->>'frecuencia',' · ',r->>'duracion'));
 end loop;
 limpio:=limpio||jsonb_build_object('medicamentos',d->'medicamentos');
 antes:=to_jsonb(e);
 perform set_config('clinica.edicion_nota_admin','confirmado',true);
 update expedientes set diagnostico=limpio->>'diagnostico',receta=nullif(v_receta,''),
 notas_doctor=concat_ws(E'\n\n',nullif(limpio->>'subjetivo',''),nullif(limpio->>'objetivo',''),nullif(limpio->>'plan',''),nullif(limpio->>'pronostico',''),nullif(limpio->>'seguimiento','')),
 contenido=contenido||limpio where id=e.id returning * into e;
 perform set_config('clinica.edicion_nota_admin','',true);
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,anterior,nuevo)
 values(auth.uid(),u.nombre_completo,'expedientes',e.id::text,'EDICION_ADMIN',antes,to_jsonb(e));
 respuesta:=jsonb_build_object('ok',true,'id',e.id,'mensaje','Cambios guardados en el expediente.');
 insert into medico_operaciones(autor,clave,solicitud,resultado) values(u.id,p_clave,solicitud,respuesta);
 return respuesta;
end $$;
revoke all on function clinica_admin_editar_nota(jsonb,uuid) from public,anon,service_role;
grant execute on function clinica_admin_editar_nota(jsonb,uuid) to authenticated;
create or replace function clinica_version() returns integer language sql stable as $$select 49$$;
notify pgrst,'reload schema';
commit;
