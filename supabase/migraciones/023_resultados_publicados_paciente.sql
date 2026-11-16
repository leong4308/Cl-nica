begin;
-- El RPC del portal permite ver que existe un estudio pendiente, pero sus
-- valores en borrador tampoco deben poder consultarse con SQL o REST directo.
create policy resultados_publicados_paciente on public.solicitudes_analisis
 as restrictive for select to authenticated
 using(public.clinica_rol() is distinct from 'paciente' or estado_analisis='completado');
create or replace function public.clinica_version() returns integer language sql stable as $$select 23$$;
notify pgrst,'reload schema';
commit;
