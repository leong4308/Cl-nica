begin;
-- Auth sigue asignando paciente mediante on_auth_user_created (033).
-- El formulario público añade la ficha obligatoria en la MISMA transacción de Auth.
create function public.clinica_ficha_autoregistro() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare d jsonb;u usuarios;f date;p bigint;k text;tel text;
begin
 if not(coalesce(new.raw_user_meta_data,'{}'::jsonb)?'cn_registro_paciente') then return new;end if;
 d:=new.raw_user_meta_data->'cn_registro_paciente';
 if jsonb_typeof(d) is distinct from 'object' or length(d::text)>2500 then raise exception 'Completa los datos personales del registro' using errcode='23514';end if;
 if exists(select 1 from jsonb_object_keys(d) x where x not in('nombre','telefono','fechaNacimiento','genero','contactoEmergencia','telefonoEmergencia')) then raise exception 'El registro público solo admite datos personales' using errcode='23514';end if;
 foreach k in array array['nombre','telefono','fechaNacimiento','genero','contactoEmergencia','telefonoEmergencia'] loop
  if jsonb_typeof(d->k) is distinct from 'string' or length(trim(d->>k))=0 or d->>k ~ '[[:cntrl:]]' then raise exception 'Todos los datos personales del registro son obligatorios' using errcode='23514';end if;
 end loop;
 if length(trim(d->>'nombre')) not between 3 and 200 or length(trim(d->>'contactoEmergencia')) not between 3 and 200 or d->>'genero' not in('M','F','O') then raise exception 'Revisa el nombre, el contacto y el género' using errcode='23514';end if;
 foreach k in array array['telefono','telefonoEmergencia'] loop
  tel:=trim(d->>k);
  if length(tel)>20 or tel !~ '^[+0-9[:space:]().-]+$' or length(regexp_replace(tel,'[^0-9]','','g')) not between 10 and 15 then raise exception 'Revisa los teléfonos del registro' using errcode='23514';end if;
 end loop;
 if d->>'fechaNacimiento' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha de nacimiento inválida' using errcode='23514';end if;
 f:=(d->>'fechaNacimiento')::date;
 if f<date '1900-01-01' or f>(clock_timestamp() at time zone 'America/Mexico_City')::date then raise exception 'Fecha de nacimiento inválida' using errcode='23514';end if;
 select * into u from usuarios where auth_user_id=new.id for update;
 if u.id is null or u.rol<>'paciente' or not u.esta_activo or exists(select 1 from perfiles_pacientes where usuario_id=u.id) then raise exception 'El autorregistro solo crea una nueva ficha de paciente' using errcode='42501';end if;
 update usuarios set nombre_completo=trim(d->>'nombre'),telefono=trim(d->>'telefono') where id=u.id;
 insert into perfiles_pacientes(usuario_id,fecha_nacimiento,genero,nombre_contacto_emergencia,telefono_emergencia)
 values(u.id,f,d->>'genero',trim(d->>'contactoEmergencia'),trim(d->>'telefonoEmergencia')) returning id into p;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo)
 values(new.id,trim(d->>'nombre'),'perfiles_pacientes',p::text,'AUTORREGISTRO',jsonb_build_object('origen','registro_publico','rol','paciente'));
 return new;
end $$;
-- Los triggers AFTER INSERT se ejecutan por nombre; primero se crea usuarios, luego su ficha.
create trigger z_registro_paciente_ficha after insert on auth.users for each row execute function clinica_ficha_autoregistro();
revoke all on function clinica_ficha_autoregistro() from public,anon,authenticated,service_role;
create function public.clinica_registro_habilitado() returns boolean language sql stable as $$select true$$;
revoke all on function clinica_registro_habilitado() from public;
grant execute on function clinica_registro_habilitado() to anon,authenticated,service_role;
create or replace function public.clinica_version() returns integer language sql stable as $$select 43$$;
notify pgrst,'reload schema';
commit;
