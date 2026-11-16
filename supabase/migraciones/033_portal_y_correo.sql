begin;
alter table usuarios add column correo_citas boolean not null default true;
create table portal_invitaciones (
 id uuid primary key default gen_random_uuid(),paciente_id bigint not null references perfiles_pacientes(id),
 correo text not null,token_hash text not null unique,autor uuid not null references auth.users(id),
 creado_en timestamptz not null default clock_timestamp(),vence_en timestamptz not null default clock_timestamp()+interval '24 hours',
 consumida_en timestamptz,auth_user_id uuid references auth.users(id),enviada_en timestamptz,codigo_error text
);
create index portal_invitaciones_paciente on portal_invitaciones(paciente_id,creado_en desc);
alter table portal_invitaciones enable row level security;
revoke all on portal_invitaciones from public,anon,authenticated;
grant all on portal_invitaciones to service_role;

-- Solo el servidor crea invitaciones: la ficha se selecciona por ID, nunca se vincula
-- una cuenta basándose únicamente en un correo proporcionado en el navegador.
create function public.clinica_invitacion_preparar(p_paciente bigint,p_actor uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;p perfiles_pacientes;v_token text;v_id uuid;
begin
 if not exists(select 1 from usuarios where auth_user_id=p_actor and esta_activo and rol in('admin','recepcionista')) then raise exception 'Solo administración y recepción invitan pacientes' using errcode='42501';end if;
 select * into p from perfiles_pacientes where id=p_paciente and esta_activo for update;
 select * into u from usuarios where id=p.usuario_id and esta_activo and rol='paciente' for update;
 if u.id is null then raise exception 'Paciente no disponible';end if;
 if u.auth_user_id is not null then raise exception 'El paciente ya tiene una cuenta. Puede recuperar su contraseña desde el inicio de sesión' using errcode='23505';end if;
 if u.correo !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or u.correo ilike '%@clinica.local' then raise exception 'Registra un correo real del paciente antes de invitarlo';end if;
 if exists(select 1 from auth.users where lower(email)=lower(u.correo)) then raise exception 'Ya existe una cuenta de acceso con ese correo. Administración debe revisar su vinculación' using errcode='23505';end if;
 if exists(select 1 from portal_invitaciones where paciente_id=p.id and creado_en>clock_timestamp()-interval '1 minute') then raise exception 'Espera un minuto antes de enviar otra invitación';end if;
 update portal_invitaciones set vence_en=least(vence_en,clock_timestamp()) where paciente_id=p.id and consumida_en is null;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into portal_invitaciones(paciente_id,correo,token_hash,autor) values(p.id,lower(u.correo),encode(sha256(convert_to(v_token,'UTF8')),'hex'),p_actor) returning id into v_id;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(p_actor,(select nombre_completo from usuarios where auth_user_id=p_actor),'portal_invitaciones',p.id::text,'INVITAR',jsonb_build_object('invitacion',v_id));
 return jsonb_build_object('id',v_id,'token',v_token,'correo',lower(u.correo),'nombre',u.nombre_completo);
end $$;

create function public.clinica_invitacion_validar(p_token text) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare i portal_invitaciones;u usuarios;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select pi.* into i from portal_invitaciones pi join perfiles_pacientes p on p.id=pi.paciente_id and p.esta_activo join usuarios uu on uu.id=p.usuario_id and uu.esta_activo and uu.rol='paciente' and lower(uu.correo)=pi.correo where pi.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and pi.vence_en>clock_timestamp();
 if i.id is null then return null;end if;
 select uu.* into u from usuarios uu join perfiles_pacientes p on p.usuario_id=uu.id where p.id=i.paciente_id;
 if i.consumida_en is not null then return jsonb_build_object('activada',true);end if;
 if u.auth_user_id is not null then return null;end if;
 return jsonb_build_object('id',i.id,'correo',i.correo,'nombre',u.nombre_completo,'activada',false);
end $$;

create or replace function public.crear_usuario_al_registrarse() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare i portal_invitaciones;u usuarios;v_token text:=new.raw_user_meta_data->>'cn_invitacion';
begin
 if v_token is not null then
  select * into i from portal_invitaciones where token_hash=encode(sha256(convert_to(v_token,'UTF8')),'hex') and consumida_en is null and vence_en>clock_timestamp() for update;
  select uu.* into u from usuarios uu join perfiles_pacientes p on p.usuario_id=uu.id and p.esta_activo where p.id=i.paciente_id for update of uu;
  if i.id is null or u.id is null or not u.esta_activo or u.rol<>'paciente' or u.auth_user_id is not null or lower(new.email) is distinct from i.correo or lower(u.correo) is distinct from i.correo or new.email_confirmed_at is null then raise exception 'La invitación ya no es válida';end if;
  update usuarios set auth_user_id=new.id where id=u.id;
  update portal_invitaciones set consumida_en=clock_timestamp(),auth_user_id=new.id where id=i.id;
  return new;
 end if;
 -- Los roles de personal se asignan posteriormente desde la API administrativa.
 -- Los metadatos públicos de un registro nunca conceden permisos de personal.
 insert into usuarios(auth_user_id,correo,nombre_completo,rol) values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'nombre_completo',''),split_part(new.email,'@',1)),'paciente') on conflict(auth_user_id) do nothing;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function crear_usuario_al_registrarse();

create function public.clinica_estado_portal(p_paciente bigint,p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u usuarios;i portal_invitaciones;
begin
 if not exists(select 1 from usuarios where auth_user_id=p_actor and esta_activo and rol in('admin','recepcionista')) then raise exception 'Sin acceso a invitaciones' using errcode='42501';end if;
 select uu.* into u from usuarios uu join perfiles_pacientes p on p.usuario_id=uu.id where p.id=p_paciente and p.esta_activo and uu.rol='paciente' and uu.esta_activo;
 if u.id is null then raise exception 'Paciente no disponible';end if;
 select * into i from portal_invitaciones where paciente_id=p_paciente order by creado_en desc limit 1;
 return jsonb_build_object('correo',case when u.correo ilike '%@clinica.local' then null else u.correo end,'activa',u.auth_user_id is not null,'invitada',i.id is not null and i.consumida_en is null and i.vence_en>clock_timestamp(),'enviada',i.enviada_en,'vence',i.vence_en,'errorEnvio',i.codigo_error is not null);
end $$;
revoke all on function clinica_invitacion_preparar(bigint,uuid),clinica_invitacion_validar(text),clinica_estado_portal(bigint,uuid),crear_usuario_al_registrarse() from public,anon,authenticated;
grant execute on function clinica_invitacion_preparar(bigint,uuid),clinica_invitacion_validar(text),clinica_estado_portal(bigint,uuid) to service_role;

create function public.clinica_preferencias_correo(p_activo boolean default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;
begin
 perform clinica_requerir_sesion();select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if p_activo is not null then update usuarios set correo_citas=p_activo where id=u.id returning * into u;end if;
 return jsonb_build_object('paciente',u.rol='paciente','activo',u.correo_citas,'correo',case when u.correo ilike '%@clinica.local' then null else u.correo end,'verificado',exists(select 1 from auth.users where id=u.auth_user_id and email_confirmed_at is not null and lower(email)=lower(u.correo)));
end $$;
revoke all on function clinica_preferencias_correo(boolean) from public,anon;
grant execute on function clinica_preferencias_correo(boolean) to authenticated;

create table correo_envios(
 id bigint generated by default as identity primary key,notificacion_id bigint not null unique references notificaciones(id) on delete cascade,correo text not null,
 estado text not null default 'pendiente' check(estado in('pendiente','enviando','enviado','omitido','fallido')),intentos integer not null default 0,
 proximo_intento timestamptz not null default clock_timestamp(),arrendamiento uuid,reservado_hasta timestamptz,codigo_error text,enviado_en timestamptz,proveedor_id text
);
alter table correo_envios enable row level security;
revoke all on correo_envios from public,anon,authenticated;
grant all on correo_envios to service_role;
grant usage,select on sequence correo_envios_id_seq to service_role;
create function public.clinica_encolar_correo() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.tipo in('cita_nueva','cita_reprogramada','cita_estado','recordatorio_24h','recordatorio_2h','recordatorio_30m') then
  insert into correo_envios(notificacion_id,correo) select new.id,lower(u.correo) from usuarios u join auth.users a on a.id=u.auth_user_id and a.email_confirmed_at is not null and lower(a.email)=lower(u.correo) join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo join citas c on c.paciente_id=p.id and c.id=new.cita_id where u.id=new.usuario_id and u.rol='paciente' and u.esta_activo and u.correo_citas and u.correo not ilike '%@clinica.local' on conflict do nothing;
 end if;return new;
end $$;
create trigger notificacion_correo after insert on notificaciones for each row execute function clinica_encolar_correo();

create function public.clinica_correo_vigente(p_id bigint,p_arrendamiento uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',e.id,'correo',e.correo,'titulo',n.titulo,'tipo',n.tipo,'cita',jsonb_build_object('id',c.id,'inicio',c.inicio,'fin',c.fin,'estado',c.estado,'paciente',u.nombre_completo,'medico',um.nombre_completo,'clinica',cl.nombre,'direccion',cl.direccion))
 from correo_envios e join notificaciones n on n.id=e.notificacion_id join usuarios u on u.id=n.usuario_id and u.esta_activo and u.rol='paciente' and u.correo_citas and lower(u.correo)=e.correo
 join auth.users a on a.id=u.auth_user_id and lower(a.email)=e.correo and a.email_confirmed_at is not null
 join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo join citas c on c.id=n.cita_id and c.paciente_id=p.id
 join perfiles_medicos m on m.id=c.medico_id join usuarios um on um.id=m.usuario_id join clinicas cl on cl.id=c.clinica_id
 where e.id=p_id and e.arrendamiento=p_arrendamiento and e.estado='enviando'
 and n.creado_en>clock_timestamp()-interval '23 hours' and n.cita_version=md5(concat_ws(':',extract(epoch from c.inicio),extract(epoch from c.fin),c.medico_id,c.paciente_id,c.estado))
 and (n.tipo not like 'recordatorio_%' or(c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp()))
 and (n.tipo not in('cita_nueva','cita_reprogramada') or(c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp()))
$$;
create function public.clinica_correo_operar(p_reserva uuid,p_operacion text,p_datos jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint;v_arr uuid;resultado jsonb;
begin
 if not clinica_reservar_trabajador(p_reserva) then raise exception 'RESERVA_OCUPADA' using errcode='55P03';end if;
 if jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>2000 then raise exception 'Parámetros inválidos';end if;
 if p_operacion='reclamar' then
  update correo_envios e set estado='omitido',reservado_hasta=null from notificaciones n where n.id=e.notificacion_id and e.estado in('pendiente','enviando') and n.creado_en<=clock_timestamp()-interval '23 hours';
  update correo_envios set estado='fallido',reservado_hasta=null where estado='enviando' and intentos>=5 and reservado_hasta<=clock_timestamp();
  with candidatos as(select e.id from correo_envios e join notificaciones n on n.id=e.notificacion_id where e.intentos<5 and n.creado_en>clock_timestamp()-interval '23 hours' and (e.estado='pendiente' and e.proximo_intento<=clock_timestamp() or e.estado='enviando' and e.reservado_hasta<=clock_timestamp()) order by e.id limit 5 for update of e skip locked),tomados as(update correo_envios e set estado='enviando',intentos=intentos+1,arrendamiento=gen_random_uuid(),reservado_hasta=clock_timestamp()+interval '3 minutes' from candidatos c where c.id=e.id returning e.id,e.arrendamiento)
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into resultado from tomados t;return resultado;
 end if;
 v_id:=(p_datos->>'id')::bigint;v_arr:=(p_datos->>'arrendamiento')::uuid;
 if p_operacion='vigente' then return clinica_correo_vigente(v_id,v_arr);
 elsif p_operacion='enviado' then update correo_envios set estado='enviado',enviado_en=clock_timestamp(),proveedor_id=left(p_datos->>'proveedorId',100),reservado_hasta=null,codigo_error=null where id=v_id and arrendamiento=v_arr and estado='enviando';
 elsif p_operacion='omitir' then update correo_envios set estado='omitido',reservado_hasta=null where id=v_id and arrendamiento=v_arr and estado='enviando';
 elsif p_operacion='error' then update correo_envios set estado=case when intentos>=5 or coalesce((p_datos->>'permanente')::boolean,false) then 'fallido' else 'pendiente' end,codigo_error=left(p_datos->>'codigo',30),reservado_hasta=null,proximo_intento=clock_timestamp()+make_interval(secs=>least(3600,greatest(60,coalesce((p_datos->>'espera')::integer,60),60*intentos))) where id=v_id and arrendamiento=v_arr and estado='enviando';
 else raise exception 'Operación de correo inválida';end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function clinica_encolar_correo(),clinica_correo_vigente(bigint,uuid),clinica_correo_operar(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function clinica_correo_operar(uuid,text,jsonb) to service_role;
create or replace function public.clinica_version() returns integer language sql stable as $$select 33$$;
notify pgrst,'reload schema';
commit;
