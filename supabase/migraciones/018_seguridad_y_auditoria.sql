-- Aplicar una sola vez después del esquema existente. No elimina historias clínicas.
begin;
create table if not exists public.paciente_medicos (
  paciente_id bigint not null references public.perfiles_pacientes(id),
  medico_id bigint not null references public.perfiles_medicos(id),
  activo boolean not null default true,
  tipo text not null default 'colaborador' check (tipo in ('principal','colaborador')),
  motivo text not null default '',
  actualizado_en timestamptz not null default clock_timestamp(),
  primary key(paciente_id,medico_id)
);
create unique index if not exists paciente_medico_principal on public.paciente_medicos(paciente_id) where activo and tipo='principal';
-- Los triggers de Auth no pueden conceder roles del personal a partir de user_metadata.
-- Las altas administrativas promueven el rol explícitamente desde el servidor verificado.
create or replace function public.clinica_proteger_rol_auth() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if pg_trigger_depth()>1 then
  if tg_op='INSERT' then new.rol:='paciente'; else new.rol:=old.rol; end if;
 end if;
 return new;
end $$;
drop trigger if exists clinica_rol_auth on usuarios;
create trigger clinica_rol_auth before insert or update on usuarios for each row execute function clinica_proteger_rol_auth();
create or replace function public.clinica_conservar_admin() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.rol='admin' and old.esta_activo and (tg_op='DELETE' or new.rol<>'admin' or not new.esta_activo) then
  perform pg_advisory_xact_lock(37203,0);
  if not exists(select 1 from usuarios where rol='admin' and esta_activo and id<>old.id) then raise exception 'Debe conservarse al menos un administrador activo' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists clinica_ultimo_admin on usuarios;
create trigger clinica_ultimo_admin before update or delete on usuarios for each row execute function clinica_conservar_admin();
create table if not exists public.auditoria_clinica (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default clock_timestamp(),
  autor uuid,
  autor_nombre text,
  tabla text not null,
  registro_id text not null,
  accion text not null,
  anterior jsonb,
  nuevo jsonb
);
alter table public.auditoria_clinica add column if not exists autor_nombre text;
create index if not exists auditoria_registro on public.auditoria_clinica(tabla,registro_id,fecha desc);
create table if not exists public.configuracion_agenda (
  medico_id bigint primary key references public.perfiles_medicos(id),
  bloques jsonb not null default '[]', descansos jsonb not null default '[]',
  actualizado_en timestamptz not null default clock_timestamp()
);

create or replace function public.clinica_rol() returns text language sql stable security definer set search_path=public,pg_temp as $$
 select rol::text from usuarios where auth_user_id=auth.uid() and esta_activo
$$;
create or replace function public.clinica_medico() returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select m.id from perfiles_medicos m join usuarios u on u.id=m.usuario_id where u.auth_user_id=auth.uid() and u.esta_activo and u.rol='medico' and m.esta_activo order by m.id limit 1
$$;
create or replace function public.clinica_paciente(p_id bigint) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_rol text:=clinica_rol(); v_medico bigint; v_activo boolean;
begin
 if v_rol in ('admin','recepcionista','enfermero') then return true; end if;
 if v_rol='paciente' then return exists(select 1 from perfiles_pacientes p join usuarios u on u.id=p.usuario_id where p.id=p_id and u.auth_user_id=auth.uid()); end if;
 if v_rol is distinct from 'medico' then return false; end if;
 v_medico:=clinica_medico();
 select activo into v_activo from paciente_medicos where paciente_id=p_id and medico_id=v_medico;
 if found then return v_activo; end if;
 return exists(select 1 from citas where paciente_id=p_id and medico_id=v_medico and estado in ('pendiente','confirmada','atendida'))
     or exists(select 1 from internaciones where paciente_id=p_id and medico_responsable_id=v_medico);
end $$;
create or replace function public.clinica_usuario_visible(p_id bigint) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from usuarios u where u.id=p_id and (u.auth_user_id=auth.uid() or
   (clinica_rol() in ('admin','recepcionista','enfermero')) or
   (clinica_rol()='medico' and (u.rol in ('medico','enfermero') or exists(select 1 from perfiles_pacientes p where p.usuario_id=u.id and clinica_paciente(p.id))))))
$$;
create or replace function public.clinica_expediente(p_id bigint) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from expedientes e join citas c on c.id=e.cita_id where e.id=p_id and clinica_paciente(c.paciente_id))
$$;
create or replace function public.clinica_orden(p_id bigint) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from ordenes_medicas o join episodios_medicos e on e.id=o.episodio_id join internaciones i on i.id=e.internacion_id where o.id=p_id and clinica_paciente(i.paciente_id))
$$;

-- Materializa relaciones existentes sin escoger arbitrariamente un médico principal.
insert into paciente_medicos(paciente_id,medico_id,motivo)
 select paciente_id,medico_id,'Relación de atención existente' from citas where estado in ('pendiente','confirmada','atendida')
 union select paciente_id,medico_responsable_id,'Relación de atención existente' from internaciones
 on conflict do nothing;

create or replace function public.clinica_auditar() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old jsonb; v_new jsonb; v_autor uuid; v_nombre text;
begin
 if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then v_new:=to_jsonb(new); end if;
 if tg_op='UPDATE' and v_old=v_new then return new; end if;
 v_autor:=coalesce(auth.uid(),case when coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')='service_role' then (nullif(current_setting('request.headers',true),'')::jsonb->>'x-clinica-actor')::uuid end);
 select nombre_completo into v_nombre from usuarios where auth_user_id=v_autor;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,anterior,nuevo)
 values(v_autor,coalesce(v_nombre,'Operación del sistema'),tg_table_name,coalesce(v_new->>'id',v_old->>'id',concat_ws(':',coalesce(v_new,v_old)->>'paciente_id',coalesce(v_new,v_old)->>'medico_id')),tg_op,v_old,v_new);
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function public.clinica_actualizar_paciente(p_paciente bigint,p_datos jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p perfiles_pacientes;
begin
 if clinica_rol() not in ('admin','medico','enfermero','recepcionista') or clinica_rol() is null or not clinica_paciente(p_paciente) then raise exception 'Paciente sin acceso' using errcode='42501'; end if;
 if length(trim(coalesce(p_datos->>'nombre',''))) not between 1 and 200 or length(coalesce(p_datos->>'telefono',''))>20 or length(coalesce(p_datos->>'contactoEmergencia',''))>200 or length(coalesce(p_datos->>'telefonoEmergencia',''))>20 then raise exception 'Revisa los datos personales'; end if;
 if nullif(p_datos->>'fechaNacimiento','')::date>current_date or coalesce(p_datos->>'genero','') not in ('','M','F','O') then raise exception 'Revisa el nacimiento y el género'; end if;
 select * into p from perfiles_pacientes where id=p_paciente for update;
 if not found then raise exception 'Paciente no encontrado'; end if;
 update usuarios set nombre_completo=trim(p_datos->>'nombre'),telefono=nullif(trim(p_datos->>'telefono'),'') where id=p.usuario_id;
 update perfiles_pacientes set fecha_nacimiento=nullif(p_datos->>'fechaNacimiento','')::date,genero=nullif(p_datos->>'genero',''),nombre_contacto_emergencia=nullif(trim(p_datos->>'contactoEmergencia'),''),telefono_emergencia=nullif(trim(p_datos->>'telefonoEmergencia'),'') where id=p_paciente;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.clinica_registrar_paciente(p_datos jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_usuario bigint; v_paciente bigint; v_medico bigint;
begin
 if clinica_rol() not in ('admin','medico','enfermero','recepcionista') or clinica_rol() is null then raise exception 'No tienes permiso para registrar pacientes' using errcode='42501'; end if;
 if length(trim(coalesce(p_datos->>'nombre',''))) not between 1 and 200 or length(coalesce(p_datos->>'telefono',''))>20 or length(coalesce(p_datos->>'contactoEmergencia',''))>200 or length(coalesce(p_datos->>'telefonoEmergencia',''))>20 then raise exception 'Revisa los datos personales'; end if;
 if nullif(p_datos->>'fechaNacimiento','')::date>current_date or coalesce(p_datos->>'genero','') not in ('','M','F','O') then raise exception 'Revisa el nacimiento y el género'; end if;
 insert into usuarios(correo,nombre_completo,telefono,rol) values(coalesce(nullif(lower(trim(p_datos->>'correo')),''),'paciente_'||gen_random_uuid()::text||'@clinica.local'),trim(p_datos->>'nombre'),nullif(trim(p_datos->>'telefono'),''),'paciente') returning id into v_usuario;
 insert into perfiles_pacientes(usuario_id,fecha_nacimiento,genero,nombre_contacto_emergencia,telefono_emergencia,notas_medicas) values(v_usuario,nullif(p_datos->>'fechaNacimiento','')::date,nullif(p_datos->>'genero',''),nullif(trim(p_datos->>'contactoEmergencia'),''),nullif(trim(p_datos->>'telefonoEmergencia'),''),nullif(p_datos->>'notasMedicas','')) returning id into v_paciente;
 if clinica_rol()='medico' then
  v_medico:=clinica_medico(); if v_medico is null then raise exception 'Tu cuenta no tiene un perfil médico activo'; end if;
  insert into paciente_medicos(paciente_id,medico_id,tipo,motivo) values(v_paciente,v_medico,'principal','Registrado por el médico tratante');
 end if;
 return jsonb_build_object('id',v_paciente,'nombre',trim(p_datos->>'nombre'));
end $$;
create or replace function public.clinica_auditar_documento(p_tipo text,p_id bigint,p_accion text,p_nombre text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare permitido boolean:=false;
begin
 if p_accion not in ('ADJUNTAR_DOCUMENTO','ABRIR_DOCUMENTO') or length(coalesce(p_nombre,''))>200 then raise exception 'Evento inválido'; end if;
 if p_tipo='expedientes' then permitido:=clinica_rol() in ('admin','medico','recepcionista') and clinica_expediente(p_id);
 elsif p_tipo='ordenes' then permitido:=clinica_rol() in ('admin','medico','enfermero') and clinica_orden(p_id);
 elsif p_tipo='laboratorio' then select clinica_rol() in ('admin','medico','enfermero') and clinica_orden(orden_medica_id) into permitido from solicitudes_analisis where id=p_id; end if;
 if permitido is distinct from true then raise exception 'Documento sin acceso' using errcode='42501'; end if;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(auth.uid(),(select nombre_completo from usuarios where auth_user_id=auth.uid()),p_tipo,p_id::text,p_accion,jsonb_build_object('documento',p_nombre));
end $$;
do $$ declare t text; begin
 foreach t in array array['usuarios','perfiles_pacientes','citas','expedientes','internaciones','episodios_medicos','ordenes_medicas','solicitudes_analisis','paciente_medicos','configuracion_agenda'] loop
  execute format('drop trigger if exists clinica_auditoria on public.%I',t);
  execute format('create trigger clinica_auditoria after insert or update or delete on public.%I for each row execute function public.clinica_auditar()',t);
 end loop;
end $$;

create or replace function public.clinica_version_asignacion(p_id bigint) returns text language sql stable security definer set search_path=public,pg_temp as $$
 select md5(coalesce(string_agg(concat_ws(':',medico_id,activo,tipo,actualizado_en),',' order by medico_id),'')) from paciente_medicos where paciente_id=p_id
$$;
create or replace function public.clinica_historial_paciente(p_paciente bigint) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if clinica_rol() not in ('admin','medico','enfermero','paciente') or clinica_rol() is null or not clinica_paciente(p_paciente) then raise exception 'Historial sin acceso' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.creado_en desc) from (
  select e.id,e.cita_id,e.diagnostico,e.receta,e.notas_doctor,e.creado_en,c.motivo,u.nombre_completo as medico
  from expedientes e join citas c on c.id=e.cita_id join perfiles_medicos m on m.id=c.medico_id join usuarios u on u.id=m.usuario_id where c.paciente_id=p_paciente order by e.creado_en desc limit 20
 ) q),'[]'::jsonb);
end $$;
create or replace function public.clinica_asignar_medicos(p_paciente bigint,p_medicos jsonb,p_version text,p_motivo text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb;
begin
 if clinica_rol()<>'admin' or clinica_rol() is null then raise exception 'Solo administración puede asignar médicos' using errcode='42501'; end if;
 perform 1 from perfiles_pacientes where id=p_paciente for update;
 if not found then raise exception 'Paciente no encontrado'; end if;
 if p_version is distinct from clinica_version_asignacion(p_paciente) then raise exception 'La asignación cambió. Vuelve a cargarla' using errcode='40001'; end if;
 if jsonb_typeof(p_medicos)<>'array' or jsonb_array_length(p_medicos)>30 or length(trim(coalesce(p_motivo,''))) not between 3 and 1000 then raise exception 'Revisa los médicos y el motivo del cambio'; end if;
 if (select count(*) from jsonb_array_elements(p_medicos) x where x->>'tipo'='principal')>1 then raise exception 'Solo puede existir un médico principal'; end if;
 if (select count(*) from jsonb_array_elements(p_medicos))<>(select count(distinct x->>'id') from jsonb_array_elements(p_medicos) x) then raise exception 'No repitas médicos'; end if;
 if exists(select 1 from citas c where c.paciente_id=p_paciente and c.estado in ('pendiente','confirmada') and c.inicio>now() and not exists(select 1 from jsonb_array_elements(p_medicos) x where (x->>'id')::bigint=c.medico_id)) then raise exception 'Hay citas futuras con un médico que estás retirando. Reagéndalas o cancélalas antes de transferir al paciente'; end if;
 if exists(select 1 from internaciones i where i.paciente_id=p_paciente and i.estado='activa' and not exists(select 1 from jsonb_array_elements(p_medicos) x where (x->>'id')::bigint=i.medico_responsable_id)) then raise exception 'Actualiza primero el médico responsable de la hospitalización activa'; end if;
 update paciente_medicos set activo=false,actualizado_en=clock_timestamp(),motivo=p_motivo where paciente_id=p_paciente;
 for r in select * from jsonb_array_elements(p_medicos) loop
  if r->>'tipo' not in ('principal','colaborador') or not exists(select 1 from perfiles_medicos m join usuarios u on u.id=m.usuario_id where m.id=(r->>'id')::bigint and m.esta_activo and u.esta_activo and u.rol='medico') then raise exception 'Selecciona médicos activos'; end if;
  insert into paciente_medicos(paciente_id,medico_id,tipo,motivo) values(p_paciente,(r->>'id')::bigint,r->>'tipo',p_motivo)
   on conflict(paciente_id,medico_id) do update set activo=true,tipo=excluded.tipo,motivo=excluded.motivo,actualizado_en=clock_timestamp();
 end loop;
 return jsonb_build_object('ok',true,'version',clinica_version_asignacion(p_paciente));
end $$;

-- Sustituye permisos antiguos: las políticas permisivas se combinan con OR.
do $$ declare r record; begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename=any(array['usuarios','perfiles_medicos','perfiles_enfermeros','perfiles_pacientes','citas','expedientes','internaciones','episodios_medicos','ordenes_medicas','solicitudes_analisis','paciente_medicos','auditoria_clinica','configuracion_agenda','clinicas','camas','habitaciones','catalogo_analisis']) loop
  execute format('drop policy %I on public.%I',r.policyname,r.tablename);
 end loop;
end $$;
alter table paciente_medicos enable row level security;
alter table auditoria_clinica enable row level security;
alter table configuracion_agenda enable row level security;
create policy usuarios_lectura on usuarios for select to authenticated using (clinica_usuario_visible(id));
create policy usuarios_perfil on usuarios for update to authenticated using(auth_user_id=auth.uid() and esta_activo) with check(auth_user_id=auth.uid() and esta_activo);
revoke update on usuarios from authenticated;
grant update(nombre_completo,telefono) on usuarios to authenticated;
create policy pacientes_lectura on perfiles_pacientes for select to authenticated using(clinica_paciente(id));
create policy pacientes_escritura on perfiles_pacientes for update to authenticated using(clinica_rol() in ('admin','medico','enfermero','recepcionista') and clinica_paciente(id)) with check(clinica_paciente(id));
create policy asignaciones_lectura on paciente_medicos for select to authenticated using(clinica_rol()='admin' or (medico_id=clinica_medico() and activo));
create policy auditoria_admin on auditoria_clinica for select to authenticated using(clinica_rol()='admin');
create policy agenda_lectura on configuracion_agenda for select to authenticated using(clinica_rol() in ('admin','recepcionista','enfermero') or medico_id=clinica_medico());
create policy citas_lectura on citas for select to authenticated using(clinica_rol() in ('admin','recepcionista','enfermero') or (clinica_rol()='medico' and medico_id=clinica_medico() and clinica_paciente(paciente_id)) or (clinica_rol()='paciente' and clinica_paciente(paciente_id)));
create policy citas_insertar on citas for insert to authenticated with check(clinica_rol() in ('admin','recepcionista') or (clinica_rol()='medico' and medico_id=clinica_medico() and clinica_paciente(paciente_id)));
create policy citas_editar on citas for update to authenticated using(clinica_rol() in ('admin','recepcionista') or (clinica_rol()='medico' and medico_id=clinica_medico() and clinica_paciente(paciente_id))) with check(clinica_rol() in ('admin','recepcionista') or (clinica_rol()='medico' and medico_id=clinica_medico() and clinica_paciente(paciente_id)));
create policy citas_borrar on citas for delete to authenticated using(clinica_rol()='admin');
create policy expedientes_lectura on expedientes for select to authenticated using(clinica_rol() in ('admin','recepcionista','enfermero') or (clinica_rol() in ('medico','paciente') and clinica_expediente(id)));
create policy expedientes_insertar on expedientes for insert to authenticated with check(clinica_rol()='admin' or (clinica_rol()='medico' and exists(select 1 from citas c where c.id=cita_id and c.medico_id=clinica_medico() and clinica_paciente(c.paciente_id))));
create policy expedientes_editar on expedientes for update to authenticated using(clinica_rol()='admin' or (clinica_rol()='medico' and clinica_expediente(id))) with check(clinica_rol()='admin' or (clinica_rol()='medico' and clinica_expediente(id)));
create policy expedientes_borrar on expedientes for delete to authenticated using(clinica_rol()='admin');
create policy internaciones_lectura on internaciones for select to authenticated using(clinica_rol() in ('admin','enfermero','recepcionista') or (clinica_rol() in ('medico','paciente') and clinica_paciente(paciente_id)));
create policy episodios_lectura on episodios_medicos for select to authenticated using(exists(select 1 from internaciones i where i.id=internacion_id and clinica_paciente(i.paciente_id)));
create policy episodios_insertar on episodios_medicos for insert to authenticated with check(clinica_rol() in ('admin','medico','enfermero') and exists(select 1 from internaciones i where i.id=internacion_id and clinica_paciente(i.paciente_id)));
create policy ordenes_lectura on ordenes_medicas for select to authenticated using(clinica_rol() in ('admin','medico','enfermero','paciente') and clinica_orden(id));
create policy ordenes_insertar on ordenes_medicas for insert to authenticated with check(clinica_rol() in ('admin','medico','enfermero') and exists(select 1 from episodios_medicos e join internaciones i on i.id=e.internacion_id where e.id=episodio_id and clinica_paciente(i.paciente_id)));
create policy ordenes_editar on ordenes_medicas for update to authenticated using(clinica_rol() in ('admin','medico','enfermero') and clinica_orden(id)) with check(clinica_orden(id));
create policy ordenes_borrar on ordenes_medicas for delete to authenticated using(clinica_rol()='admin');
create policy laboratorio_lectura on solicitudes_analisis for select to authenticated using(clinica_rol() in ('admin','medico','enfermero','paciente') and clinica_orden(orden_medica_id));
create policy laboratorio_insertar on solicitudes_analisis for insert to authenticated with check(clinica_rol() in ('admin','medico','enfermero') and clinica_orden(orden_medica_id));
create policy laboratorio_editar on solicitudes_analisis for update to authenticated using(clinica_rol() in ('admin','medico','enfermero') and clinica_orden(orden_medica_id)) with check(clinica_orden(orden_medica_id));
create policy laboratorio_borrar on solicitudes_analisis for delete to authenticated using(clinica_rol()='admin');
do $$ declare t text; begin
 foreach t in array array['perfiles_medicos','perfiles_enfermeros','clinicas','camas','habitaciones','catalogo_analisis'] loop
  execute format('create policy catalogo_personal on public.%I for select to authenticated using(public.clinica_rol() is not null)',t);
 end loop;
end $$;
grant select on paciente_medicos,auditoria_clinica,configuracion_agenda to authenticated;
revoke insert,update,delete on paciente_medicos,auditoria_clinica,configuracion_agenda,internaciones,camas,perfiles_pacientes from authenticated;
grant all on paciente_medicos,auditoria_clinica,configuracion_agenda to service_role;
grant usage,select on all sequences in schema public to service_role;
-- Protege los buckets clínicos incluso si existe una política antigua permisiva.
do $$ begin
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists clinica_documentos_solo_servidor on storage.objects';
  execute $p$create policy clinica_documentos_solo_servidor on storage.objects as restrictive for all to authenticated using(bucket_id not in ('documentos-clinicos','resultados-laboratorio','agenda-medica')) with check(bucket_id not in ('documentos-clinicos','resultados-laboratorio','agenda-medica'))$p$;
 end if;
end $$;
-- Ninguna función nueva puede ejecutarse anónimamente.
do $$ declare r record; begin
 for r in select oid::regprocedure as firma from pg_proc where pronamespace='public'::regnamespace and proname like 'clinica_%' loop
  execute format('revoke all on function %s from public,anon',r.firma);
  execute format('grant execute on function %s to authenticated,service_role',r.firma);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
