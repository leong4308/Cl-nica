begin;
-- Conserva el mismo número: solo retira separadores de teléfonos nacionales de 10 dígitos.
-- Los números de otra longitud no se adivinan ni se recortan.
update public.usuarios set telefono=regexp_replace(telefono,'[^0-9]','','g')
where telefono ~ '^[0-9 ().-]+$' and length(regexp_replace(telefono,'[^0-9]','','g'))=10 and telefono !~ '^[0-9]{10}$';
update public.perfiles_pacientes set telefono_emergencia=regexp_replace(telefono_emergencia,'[^0-9]','','g')
where telefono_emergencia ~ '^[0-9 ().-]+$' and length(regexp_replace(telefono_emergencia,'[^0-9]','','g'))=10 and telefono_emergencia !~ '^[0-9]{10}$';

create function public.clinica_nombre_persona_valido(p_nombre text) returns boolean
language sql immutable set search_path=public,pg_temp as $$
 select p_nombre is not null and length(trim(p_nombre)) between 3 and 200
 and p_nombre ~ '^[[:alpha:]̀-ͯ .’''-]+$' and p_nombre ~ '[[:alpha:]]'
$$;
revoke all on function public.clinica_nombre_persona_valido(text) from public,anon,authenticated,service_role;

create function public.clinica_validar_contactos() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='usuarios' then
  if tg_op='INSERT' or new.nombre_completo is distinct from old.nombre_completo then
   if not clinica_nombre_persona_valido(new.nombre_completo) then raise exception 'El nombre debe tener de 3 a 200 caracteres, sin números ni símbolos' using errcode='23514';end if;
   new.nombre_completo:=trim(new.nombre_completo);
  end if;
  if tg_op='INSERT' or new.telefono is distinct from old.telefono then
   if coalesce(new.telefono,'')<>'' and new.telefono !~ '^[0-9]{10}$' then raise exception 'El teléfono debe contener exactamente 10 dígitos, sin espacios ni prefijo de país' using errcode='23514';end if;
   new.telefono:=nullif(new.telefono,'');
  end if;
  if tg_op='INSERT' or new.correo is distinct from old.correo then
   if new.correo is null or length(trim(new.correo))>150 or trim(new.correo) !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$' then raise exception 'Escribe un correo electrónico válido de hasta 150 caracteres' using errcode='23514';end if;
   new.correo:=lower(trim(new.correo));
  end if;
 else
  if tg_op='INSERT' or new.fecha_nacimiento is distinct from old.fecha_nacimiento then
   if new.fecha_nacimiento is not null and (new.fecha_nacimiento < date '1900-01-01' or new.fecha_nacimiento > (clock_timestamp() at time zone 'America/Mexico_City')::date) then raise exception 'La fecha de nacimiento debe estar entre 1900 y hoy' using errcode='23514';end if;
  end if;
  if tg_op='INSERT' or new.genero is distinct from old.genero then
   if new.genero is not null and new.genero not in('M','F','O') then raise exception 'Selecciona un género válido' using errcode='23514';end if;
  end if;
  if tg_op='INSERT' or new.nombre_contacto_emergencia is distinct from old.nombre_contacto_emergencia or new.telefono_emergencia is distinct from old.telefono_emergencia then
   new.nombre_contacto_emergencia:=nullif(trim(new.nombre_contacto_emergencia),'');
   new.telefono_emergencia:=nullif(new.telefono_emergencia,'');
   if (new.nombre_contacto_emergencia is null) <> (new.telefono_emergencia is null) then raise exception 'Completa el nombre y el teléfono de emergencia, o deja ambos vacíos' using errcode='23514';end if;
   if new.nombre_contacto_emergencia is not null and not clinica_nombre_persona_valido(new.nombre_contacto_emergencia) then raise exception 'Revisa el nombre del contacto de emergencia' using errcode='23514';end if;
   if new.telefono_emergencia is not null and new.telefono_emergencia !~ '^[0-9]{10}$' then raise exception 'El teléfono de emergencia debe contener exactamente 10 dígitos' using errcode='23514';end if;
  end if;
  if tg_op='INSERT' or new.notas_medicas is distinct from old.notas_medicas then
   if length(new.notas_medicas)>8000 then raise exception 'Las notas admiten hasta 8000 caracteres' using errcode='23514';end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.clinica_validar_contactos() from public,anon,authenticated,service_role;
-- Cada campo se valida al crearse o cambiar. Un dato histórico pendiente de revisión
-- no bloquea operaciones ajenas, por ejemplo cambiar preferencias de notificación.
create trigger validar_contactos_usuario before insert or update on public.usuarios for each row execute function public.clinica_validar_contactos();
create trigger validar_contactos_paciente before insert or update on public.perfiles_pacientes for each row execute function public.clinica_validar_contactos();
create or replace function public.clinica_version() returns integer language sql stable as $$select 44$$;
notify pgrst,'reload schema';
commit;
