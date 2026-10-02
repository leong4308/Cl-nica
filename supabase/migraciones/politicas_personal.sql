-- Clínica Nova · Migración 006
-- El personal de la clínica (admin, médico, enfermero, recepción) necesita ver
-- los perfiles de los pacientes para mostrar sus nombres en las citas y el
-- módulo Pacientes. Antes solo un paciente podía ver su propio perfil, así que
-- las agendas salían con "—" en lugar del nombre.
-- Idempotente: puede ejecutarse más de una vez sin borrar datos.

-- ─── Helper: ¿el usuario actual pertenece al personal? ───
create or replace function public.es_personal_clinico()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where auth_user_id = (select auth.uid())
      and rol in ('admin', 'medico', 'enfermero', 'recepcionista')
      and esta_activo = true
  );
$$;

-- El personal puede leer los perfiles de pacientes.
drop policy if exists pacientes_staff_select on public.perfiles_pacientes;
create policy pacientes_staff_select on public.perfiles_pacientes for select to authenticated
  using (public.es_personal_clinico());

-- El personal necesita leer `usuarios` para resolver el nombre del paciente
-- (nombre_completo vive ahí, no en perfiles_pacientes).
drop policy if exists usuarios_staff_select on public.usuarios;
create policy usuarios_staff_select on public.usuarios for select to authenticated
  using (auth_user_id = (select auth.uid()) or public.es_personal_clinico());

-- ─── Verificación ───
select
  (select count(*) from public.perfiles_medicos) as medicos,
  (select count(*) from public.perfiles_pacientes) as pacientes,
  (select count(*) from public.citas) as citas,
  (select count(*) from public.agenda_medicos) as bloques_agenda;