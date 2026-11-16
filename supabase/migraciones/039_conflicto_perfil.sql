begin;
-- Un formulario desactualizado es un conflicto HTTP, no un fallo de serialización para reintentar.
-- https://docs.postgrest.org/en/v14/references/errors.html#raise-errors-with-http-status-codes
alter function public.clinica_guardar_mis_datos(jsonb,text) rename to clinica_guardar_mis_datos_v38;
revoke all on function clinica_guardar_mis_datos_v38(jsonb,text) from public,anon,authenticated,service_role;
create function public.clinica_guardar_mis_datos(p_datos jsonb,p_version text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return clinica_guardar_mis_datos_v38(p_datos,p_version);
exception when sqlstate '40001' then
 raise exception '%',sqlerrm using errcode='PT409';
end $$;
revoke all on function clinica_guardar_mis_datos(jsonb,text) from public,anon;
grant execute on function clinica_guardar_mis_datos(jsonb,text) to authenticated;
create or replace function public.clinica_version() returns integer language sql stable as $$select 39$$;
notify pgrst,'reload schema';
commit;
