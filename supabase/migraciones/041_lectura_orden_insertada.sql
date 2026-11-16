-- INSERT ... RETURNING debe comprobar el episodio ya existente, sin volver a
-- buscar la fila recién insertada mediante una función STABLE.
begin;
create function public.clinica_episodio_accesible(p_id bigint) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select clinica_sesion_activa() and exists(
  select 1 from episodios_medicos ep
  left join internaciones i on i.id=ep.internacion_id left join citas c on c.id=ep.cita_id
  where ep.id=p_id and clinica_paciente(coalesce(i.paciente_id,c.paciente_id))
 )
$$;
revoke all on function clinica_episodio_accesible(bigint) from public,anon;
grant execute on function clinica_episodio_accesible(bigint) to authenticated;
drop policy ordenes_lectura on ordenes_medicas;
create policy ordenes_lectura on ordenes_medicas for select to authenticated
 using(clinica_rol() in('admin','medico','enfermero','paciente') and clinica_episodio_accesible(episodio_id));
-- Las políticas restrictivas de sesión, recepción y enfermería permanecen vigentes.
create or replace function public.clinica_version() returns integer language sql stable as $$select 41$$;
notify pgrst,'reload schema';
commit;
