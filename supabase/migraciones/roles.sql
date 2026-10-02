--  Migración 004 · Perfil médico + trigger + seguridad + RLS
--  Supabase > SQL Editor > New query > Run

-- ─── 0. Funciones de rol (las usa la seguridad de más abajo) ───
create or replace function public.rol_actual()
returns public.rol_usuario
language sql stable security definer set search_path = public
as $$
  select rol from public.usuarios where auth_user_id = (select auth.uid()) limit 1;
$$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select rol='admin' from public.usuarios where auth_user_id=(select auth.uid()) limit 1), false);
$$;

create or replace function public.es_medico()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select rol='medico' from public.usuarios where auth_user_id=(select auth.uid()) limit 1), false);
$$;

-- ─── 1. Perfil médico del doctor ───
-- Necesario para que pueda atender citas (citas.medico_id lo referencia).
insert into public.perfiles_medicos (usuario_id, clinica_id, especialidad, cedula_profesional)
select u.id, c.id, 'Medicina general', 'CED-DEMO-001'
from public.usuarios u
join public.clinicas c on c.nombre = 'Clínica Nova'
where lower(u.correo) = 'doc@doc.com'
on conflict (usuario_id, clinica_id) do nothing;

-- ─── 2. Trigger: crear la fila en usuarios al registrarse ───
-- Corre como security definer, asi que no le afecta el RLS de usuarios.
create or replace function public.crear_usuario_al_registrarse()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rol_nuevo public.rol_usuario;
  nombre_nuevo text;
begin
  begin
    rol_nuevo := (new.raw_user_meta_data ->> 'rol')::public.rol_usuario;
  exception when others then rol_nuevo := null; end;
  rol_nuevo := coalesce(rol_nuevo, 'paciente'::public.rol_usuario);
  nombre_nuevo := coalesce(
    new.raw_user_meta_data ->> 'nombre_completo',
    new.raw_user_meta_data ->> 'nombre',
    split_part(coalesce(new.email, ''), '@', 1));
  insert into public.usuarios (auth_user_id, correo, nombre_completo, rol)
  values (new.id, new.email, nombre_nuevo, rol_nuevo)
  on conflict (auth_user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.crear_usuario_al_registrarse();

-- ─── 3. Solo el administrador administra usuarios ───
drop policy if exists usuarios_admin_all on public.usuarios;
create policy usuarios_admin_all on public.usuarios
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- ─── 4. Nadie puede cambiar su propio rol ───
-- Un trigger, no una politica: las politicas permisivas de PostgreSQL se
-- combinan con OR, asi que la de "solo tu fila" dejaria pasar el cambio.
create or replace function public.bloquear_cambio_de_rol()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.rol is distinct from old.rol
     and (select auth.uid()) is not null
     and not public.es_admin() then
    raise exception 'No tienes permiso para modificar el rol de usuario';
  end if;
  return new;
end; $$;

drop trigger if exists bloquear_rol_usuarios on public.usuarios;
create trigger bloquear_rol_usuarios before update on public.usuarios
  for each row execute function public.bloquear_cambio_de_rol();

-- ─── 5. Lectura de las tablas que usa el panel ───
-- Con RLS activo y sin politica, la tabla queda bloqueada y todo sale en cero.
drop policy if exists authenticated_read_camas on public.camas;
create policy authenticated_read_camas on public.camas for select to authenticated using (true);
drop policy if exists authenticated_read_habitaciones on public.habitaciones;
create policy authenticated_read_habitaciones on public.habitaciones for select to authenticated using (true);
drop policy if exists authenticated_read_perfiles_medicos on public.perfiles_medicos;
create policy authenticated_read_perfiles_medicos on public.perfiles_medicos for select to authenticated using (true);
drop policy if exists authenticated_read_ordenes_medicas on public.ordenes_medicas;
create policy authenticated_read_ordenes_medicas on public.ordenes_medicas for select to authenticated using (true);
drop policy if exists authenticated_read_expedientes on public.expedientes;
create policy authenticated_read_expedientes on public.expedientes for select to authenticated using (true);
drop policy if exists authenticated_read_internaciones on public.internaciones;
create policy authenticated_read_internaciones on public.internaciones for select to authenticated using (true);
drop policy if exists authenticated_read_solicitudes on public.solicitudes_analisis;
create policy authenticated_read_solicitudes on public.solicitudes_analisis for select to authenticated using (true);
drop policy if exists authenticated_read_catalogo on public.catalogo_analisis;
create policy authenticated_read_catalogo on public.catalogo_analisis for select to authenticated using (true);
drop policy if exists authenticated_read_clinicas on public.clinicas;
create policy authenticated_read_clinicas on public.clinicas for select to authenticated using (true);

-- ─── 6. Verificación ───
select u.correo, u.nombre_completo, u.rol,
       (p.id is not null) as tiene_perfil_medico
from public.usuarios u
left join public.perfiles_medicos p on p.usuario_id = u.id
order by u.rol;
