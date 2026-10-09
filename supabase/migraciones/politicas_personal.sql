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

drop policy if exists pacientes_staff_select on public.perfiles_pacientes;
create policy pacientes_staff_select on public.perfiles_pacientes for select to authenticated
  using (public.es_personal_clinico());

drop policy if exists usuarios_staff_select on public.usuarios;
create policy usuarios_staff_select on public.usuarios for select to authenticated
  using (auth_user_id = (select auth.uid()) or public.es_personal_clinico());

select
  (select count(*) from public.perfiles_medicos) as medicos,
  (select count(*) from public.perfiles_pacientes) as pacientes,
  (select count(*) from public.citas) as citas,
  (select count(*) from public.agenda_medicos) as bloques_agenda;
