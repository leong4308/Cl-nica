begin;

-- Solo datos personales; la versión incluye las mismas columnas que este formulario puede guardar.
create function public.clinica_datos_personales(p_paciente bigint) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('nombre',u.nombre_completo,'telefono',coalesce(u.telefono,''),'fechaNacimiento',coalesce(p.fecha_nacimiento::text,''),'genero',coalesce(p.genero::text,''),
  'contactoEmergencia',coalesce(p.nombre_contacto_emergencia,''),'telefonoEmergencia',coalesce(p.telefono_emergencia,''),
  'version',md5(jsonb_build_array(u.nombre_completo,u.telefono,p.fecha_nacimiento,p.genero,p.nombre_contacto_emergencia,p.telefono_emergencia)::text))
 from perfiles_pacientes p join usuarios u on u.id=p.usuario_id where p.id=p_paciente
$$;
revoke all on function clinica_datos_personales(bigint) from public,anon,authenticated,service_role;

create function public.clinica_mis_datos() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p bigint;
begin
 perform clinica_requerir_sesion();
 if clinica_rol() is distinct from 'paciente' then raise exception 'Esta sección pertenece al paciente' using errcode='42501';end if;
 select pp.id into p from perfiles_pacientes pp join usuarios u on u.id=pp.usuario_id and u.auth_user_id=auth.uid() and u.esta_activo where pp.esta_activo;
 if p is null then raise exception 'No se encontró una ficha activa para tu cuenta' using errcode='42501';end if;
 return clinica_datos_personales(p);
end $$;

create function public.clinica_guardar_mis_datos(p_datos jsonb,p_version text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;p perfiles_pacientes;nacimiento date;hoy date:=(clock_timestamp() at time zone 'America/Mexico_City')::date;
begin
 perform clinica_requerir_sesion();
 if clinica_rol() is distinct from 'paciente' then raise exception 'Solo el paciente actualiza sus propios datos aquí' using errcode='42501';end if;
 if jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>3000 then raise exception 'Datos personales inválidos';end if;
 if exists(select 1 from jsonb_object_keys(p_datos) k where k not in('nombre','telefono','fechaNacimiento','genero','contactoEmergencia','telefonoEmergencia')) then raise exception 'El formulario solo admite datos personales de tu cuenta' using errcode='42501';end if;
 if exists(select 1 from unnest(array['nombre','telefono','fechaNacimiento','genero','contactoEmergencia','telefonoEmergencia']) k where jsonb_typeof(p_datos->k) is distinct from 'string') then raise exception 'Completa los campos del formulario. Puedes dejar vacíos los opcionales';end if;
 if length(trim(p_datos->>'nombre')) not between 1 and 200 or length(trim(p_datos->>'contactoEmergencia'))>200 then raise exception 'Revisa el nombre y el contacto de emergencia';end if;
 if length(p_datos->>'telefono')>20 or length(p_datos->>'telefonoEmergencia')>20 or p_datos->>'telefono' !~ '^[+0-9[:space:]().-]*$' or p_datos->>'telefonoEmergencia' !~ '^[+0-9[:space:]().-]*$' then raise exception 'Los teléfonos admiten hasta 20 caracteres, con números y separadores';end if;
 if p_datos->>'genero' not in('','M','F','O') then raise exception 'Selecciona un género válido';end if;
 if p_datos->>'fechaNacimiento'<>'' then
  if p_datos->>'fechaNacimiento' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha de nacimiento inválida';end if;
  nacimiento:=(p_datos->>'fechaNacimiento')::date;
  if nacimiento>hoy then raise exception 'La fecha de nacimiento no puede estar en el futuro';end if;
 end if;
 -- El actor y la ficha se derivan de la sesión; nunca se aceptan identificadores del navegador.
 select * into u from usuarios where auth_user_id=auth.uid() and esta_activo and rol='paciente' for update;
 select * into p from perfiles_pacientes where usuario_id=u.id and esta_activo for update;
 if u.id is null or p.id is null then raise exception 'No se encontró una ficha activa para tu cuenta' using errcode='42501';end if;
 if p_version is null or p_version is distinct from clinica_datos_personales(p.id)->>'version' then raise exception 'Tus datos cambiaron en otra ventana o en recepción. Vuelve a cargar el perfil para revisarlos; tus cambios escritos se conservan' using errcode='40001';end if;
 update usuarios set nombre_completo=trim(p_datos->>'nombre'),telefono=nullif(trim(p_datos->>'telefono'),'') where id=u.id;
 update perfiles_pacientes set fecha_nacimiento=nacimiento,genero=nullif(p_datos->>'genero',''),
  nombre_contacto_emergencia=nullif(trim(p_datos->>'contactoEmergencia'),''),telefono_emergencia=nullif(trim(p_datos->>'telefonoEmergencia'),'') where id=p.id;
 return jsonb_build_object('ok',true,'paciente',clinica_datos_personales(p.id));
end $$;
revoke all on function clinica_mis_datos(),clinica_guardar_mis_datos(jsonb,text) from public,anon;
grant execute on function clinica_mis_datos(),clinica_guardar_mis_datos(jsonb,text) to authenticated;
create or replace function public.clinica_version() returns integer language sql stable as $$select 38$$;
notify pgrst,'reload schema';
commit;
