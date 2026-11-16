begin;
create table paciente_correos_cambio(
 id uuid primary key default gen_random_uuid(),paciente_id bigint not null references perfiles_pacientes(id),auth_user_id uuid not null references auth.users(id),
 correo_anterior text not null,correo_nuevo text not null,token_hash text not null unique,autor uuid not null references auth.users(id),
 creado_en timestamptz not null default clock_timestamp(),vence_en timestamptz not null default clock_timestamp()+interval '24 hours',consumida_en timestamptz,enviada_en timestamptz,codigo_error text
);
alter table paciente_correos_cambio enable row level security;
revoke all on paciente_correos_cambio from public,anon,authenticated;
grant all on paciente_correos_cambio to service_role;
create index paciente_correos_cambio_paciente on paciente_correos_cambio(paciente_id,creado_en desc);
create function public.clinica_validar_correo_paciente(p_correo text,p_usuario bigint,p_auth uuid default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_correo is null or length(p_correo)>150 or p_correo !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_correo ilike '%@clinica.local' then raise exception 'Escribe un correo electrónico válido del paciente';end if;
 if exists(select 1 from usuarios where lower(correo)=p_correo and id<>p_usuario) or exists(select 1 from auth.users where lower(email)=p_correo and id is distinct from p_auth) then raise exception 'Ese correo ya pertenece a otra cuenta o paciente' using errcode='23505';end if;
end $$;

alter function public.clinica_actualizar_paciente(bigint,jsonb) rename to clinica_actualizar_paciente_v33;
revoke all on function clinica_actualizar_paciente_v33(bigint,jsonb) from public,anon,authenticated,service_role;
create function public.clinica_actualizar_paciente(p_paciente bigint,p_datos jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;v_correo text;r jsonb;
begin
 perform clinica_requerir_sesion();
 if p_datos ? 'correo' then
  if clinica_rol() is null or clinica_rol() not in('admin','recepcionista') then raise exception 'Solo administración y recepción modifican el correo de acceso' using errcode='42501';end if;
  select uu.* into u from usuarios uu join perfiles_pacientes p on p.usuario_id=uu.id where p.id=p_paciente and p.esta_activo and uu.esta_activo and uu.rol='paciente' for update of uu;
  if u.id is null then raise exception 'Paciente no disponible';end if;
  if u.auth_user_id is not null then raise exception 'El cambio de una cuenta activa requiere confirmación desde el nuevo correo';end if;
  if lower(trim(coalesce(p_datos->>'correoAnterior',''))) is distinct from (case when u.correo ilike '%@clinica.local' then '' else lower(u.correo) end) then raise exception 'El correo cambió. Cierra y vuelve a abrir la ficha antes de guardar' using errcode='40001';end if;
  v_correo:=lower(trim(p_datos->>'correo'));perform clinica_validar_correo_paciente(v_correo,u.id);
  update usuarios set correo=v_correo,actualizado_en=clock_timestamp() where id=u.id;
  update portal_invitaciones set vence_en=least(vence_en,clock_timestamp()) where paciente_id=p_paciente and consumida_en is null;
 end if;
 r:=clinica_actualizar_paciente_v33(p_paciente,p_datos-'correo'-'correoAnterior');
 return r||jsonb_build_object('correoActualizado',v_correo);
end $$;
revoke all on function clinica_actualizar_paciente(bigint,jsonb) from public,anon;
grant execute on function clinica_actualizar_paciente(bigint,jsonb) to authenticated;

alter function public.clinica_registrar_paciente(jsonb) rename to clinica_registrar_paciente_v33;
revoke all on function clinica_registrar_paciente_v33(jsonb) from public,anon,authenticated,service_role;
create function public.clinica_registrar_paciente(p_datos jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_correo text:=nullif(lower(trim(p_datos->>'correo')),'');
begin
 perform clinica_requerir_sesion();
 if clinica_rol() is null or clinica_rol() not in('admin','recepcionista','medico') then raise exception 'Sin acceso al registro de pacientes' using errcode='42501';end if;
 if v_correo is not null then perform clinica_validar_correo_paciente(v_correo,0);end if;
 return clinica_registrar_paciente_v33(p_datos||jsonb_build_object('correo',v_correo));
end $$;
revoke all on function clinica_registrar_paciente(jsonb) from public,anon;
grant execute on function clinica_registrar_paciente(jsonb) to authenticated;

create function public.clinica_estado_correo_paciente(p_paciente bigint,p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u usuarios;i paciente_correos_cambio;
begin
 if not exists(select 1 from usuarios where auth_user_id=p_actor and esta_activo and rol in('admin','recepcionista')) then raise exception 'Sin acceso al correo del paciente' using errcode='42501';end if;
 select uu.* into u from usuarios uu join perfiles_pacientes p on p.usuario_id=uu.id where p.id=p_paciente and p.esta_activo and uu.esta_activo and uu.rol='paciente';
 if u.id is null then raise exception 'Paciente no disponible';end if;
 select * into i from paciente_correos_cambio where paciente_id=p_paciente and consumida_en is null and vence_en>clock_timestamp() and auth_user_id=u.auth_user_id and correo_anterior=lower(u.correo) order by creado_en desc limit 1;
 return jsonb_build_object('vinculado',u.auth_user_id is not null,'pendiente',i.correo_nuevo,'correo',case when u.correo ilike '%@clinica.local' then '' else u.correo end);
end $$;

create function public.clinica_cambio_correo_preparar(p_paciente bigint,p_actor uuid,p_correo text,p_anterior text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;v_correo text:=lower(trim(p_correo));v_token text;v_id uuid;i paciente_correos_cambio;
begin
 if not exists(select 1 from usuarios where auth_user_id=p_actor and esta_activo and rol in('admin','recepcionista')) then raise exception 'Solo administración y recepción modifican el correo de acceso' using errcode='42501';end if;
 select uu.* into u from usuarios uu join perfiles_pacientes p on p.usuario_id=uu.id where p.id=p_paciente and p.esta_activo and uu.esta_activo and uu.rol='paciente' for update of uu;
 if u.id is null or u.auth_user_id is null then raise exception 'La cuenta no está vinculada';end if;
 if lower(trim(p_anterior)) is distinct from lower(u.correo) then raise exception 'El correo cambió. Vuelve a abrir la ficha' using errcode='40001';end if;
 perform clinica_validar_correo_paciente(v_correo,u.id,u.auth_user_id);
 if v_correo=lower(u.correo) then raise exception 'Escribe un correo diferente al actual';end if;
 select * into i from paciente_correos_cambio where paciente_id=p_paciente order by creado_en desc limit 1;
 if i.creado_en>clock_timestamp()-interval '1 minute' then
  if i.correo_nuevo=v_correo and i.enviada_en is not null and i.consumida_en is null and i.vence_en>clock_timestamp() then return jsonb_build_object('enviada',true,'correo',v_correo);end if;
  raise exception 'Espera un minuto antes de solicitar otro cambio de correo';
 end if;
 update paciente_correos_cambio set vence_en=least(vence_en,clock_timestamp()) where paciente_id=p_paciente and consumida_en is null;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into paciente_correos_cambio(paciente_id,auth_user_id,correo_anterior,correo_nuevo,token_hash,autor) values(p_paciente,u.auth_user_id,lower(u.correo),v_correo,encode(sha256(convert_to(v_token,'UTF8')),'hex'),p_actor) returning id into v_id;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(p_actor,(select nombre_completo from usuarios where auth_user_id=p_actor),'paciente_correos_cambio',p_paciente::text,'SOLICITAR_CORREO',jsonb_build_object('correoNuevo',v_correo));
 return jsonb_build_object('id',v_id,'token',v_token,'correo',v_correo,'nombre',u.nombre_completo);
end $$;

create function public.clinica_cambio_correo_validar(p_token text) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare i paciente_correos_cambio;u usuarios;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select * into i from paciente_correos_cambio where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and vence_en>clock_timestamp();
 if i.id is null then return null;end if;
 select uu.* into u from usuarios uu join perfiles_pacientes p on p.usuario_id=uu.id and p.esta_activo where p.id=i.paciente_id and uu.esta_activo and uu.rol='paciente' and uu.auth_user_id=i.auth_user_id;
 if u.id is null then return null;end if;
 if i.consumida_en is not null then return case when lower(u.correo)=i.correo_nuevo then jsonb_build_object('confirmada',true) else null end;end if;
 if lower(u.correo)<>i.correo_anterior then return null;end if;
 return jsonb_build_object('correo',i.correo_nuevo,'nombre',u.nombre_completo,'authId',i.auth_user_id,'confirmada',false);
end $$;

-- Auth actualiza sus identidades y public.usuarios en una sola transacción.
-- Un fallo de duplicidad o de versión revierte también el cambio de acceso.
create function public.clinica_sincronizar_correo_paciente() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;i paciente_correos_cambio;
begin
 if lower(new.email) is not distinct from lower(old.email) then return new;end if;
 select * into u from usuarios where auth_user_id=new.id and rol='paciente' for update;
 if u.id is null then return new;end if;
 select * into i from paciente_correos_cambio where auth_user_id=new.id and token_hash=encode(sha256(convert_to(new.raw_user_meta_data->>'cn_cambio_correo','UTF8')),'hex') and consumida_en is null and vence_en>clock_timestamp() for update;
 if i.id is null or not u.esta_activo or i.correo_anterior<>lower(u.correo) or i.correo_nuevo is distinct from lower(new.email) or new.email_confirmed_at is null then raise exception 'El cambio de correo requiere una confirmación vigente desde la aplicación';end if;
 perform clinica_validar_correo_paciente(lower(new.email),u.id,new.id);
 update usuarios set correo=lower(new.email),actualizado_en=clock_timestamp() where id=u.id;
 update paciente_correos_cambio set consumida_en=clock_timestamp() where id=i.id;
 update paciente_correos_cambio set vence_en=least(vence_en,clock_timestamp()) where paciente_id=i.paciente_id and id<>i.id and consumida_en is null;
 update portal_invitaciones set vence_en=least(vence_en,clock_timestamp()) where paciente_id=i.paciente_id and consumida_en is null;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(new.id,u.nombre_completo,'paciente_correos_cambio',i.paciente_id::text,'CONFIRMAR_CORREO',jsonb_build_object('solicitadoPor',i.autor,'correoNuevo',lower(new.email)));
 return new;
end $$;
create trigger correo_paciente_auth after update of email on auth.users for each row execute function clinica_sincronizar_correo_paciente();
revoke all on function clinica_validar_correo_paciente(text,bigint,uuid),clinica_estado_correo_paciente(bigint,uuid),clinica_cambio_correo_preparar(bigint,uuid,text,text),clinica_cambio_correo_validar(text),clinica_sincronizar_correo_paciente() from public,anon,authenticated;
grant execute on function clinica_estado_correo_paciente(bigint,uuid),clinica_cambio_correo_preparar(bigint,uuid,text,text),clinica_cambio_correo_validar(text) to service_role;
create or replace function public.clinica_version() returns integer language sql stable as $$select 34$$;
notify pgrst,'reload schema';
commit;
