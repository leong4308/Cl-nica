-- Políticas RLS coherentes para Ver, Editar y Eliminar según rol

-- 1. Políticas de eliminación: ÚNICAMENTE Administradores pueden borrar registros
drop policy if exists citas_admin_delete on public.citas;
create policy citas_admin_delete on public.citas
  for delete to authenticated
  using (coalesce((select rol = 'admin' from public.usuarios where auth_user_id = auth.uid()), false));

drop policy if exists expedientes_admin_delete on public.expedientes;
create policy expedientes_admin_delete on public.expedientes
  for delete to authenticated
  using (coalesce((select rol = 'admin' from public.usuarios where auth_user_id = auth.uid()), false));

drop policy if exists internaciones_admin_delete on public.internaciones;
create policy internaciones_admin_delete on public.internaciones
  for delete to authenticated
  using (coalesce((select rol = 'admin' from public.usuarios where auth_user_id = auth.uid()), false));

drop policy if exists ordenes_admin_delete on public.ordenes_medicas;
create policy ordenes_admin_delete on public.ordenes_medicas
  for delete to authenticated
  using (coalesce((select rol = 'admin' from public.usuarios where auth_user_id = auth.uid()), false));

drop policy if exists solicitudes_admin_delete on public.solicitudes_analisis;
create policy solicitudes_admin_delete on public.solicitudes_analisis
  for delete to authenticated
  using (coalesce((select rol = 'admin' from public.usuarios where auth_user_id = auth.uid()), false));

-- 2. Políticas de edición / actualización clínica:
-- Médicos, Enfermeros y Administradores pueden actualizar expedientes, órdenes y resultados
drop policy if exists expedientes_authenticated_update on public.expedientes;
create policy expedientes_authenticated_update on public.expedientes
  for update to authenticated
  using (coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false))
  with check (coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false));

drop policy if exists internaciones_staff_update on public.internaciones;
create policy internaciones_staff_update on public.internaciones
  for update to authenticated
  using (coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false))
  with check (coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false));

drop policy if exists ordenes_staff_update on public.ordenes_medicas;
create policy ordenes_staff_update on public.ordenes_medicas
  for update to authenticated
  using (coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false))
  with check (coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false));

drop policy if exists solicitudes_staff_update on public.solicitudes_analisis;
create policy solicitudes_staff_update on public.solicitudes_analisis
  for update to authenticated
  using (coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false))
  with check (coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false));
