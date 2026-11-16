begin;
-- Un chat solo puede pertenecer a una cuenta activa. Desvincularlo debe
-- permitir que su titular lo vincule después a otra cuenta de pruebas.
alter table public.telegram_cuentas drop constraint telegram_cuentas_chat_id_key;
create unique index telegram_chat_activo on public.telegram_cuentas(chat_id) where activo;
create or replace function public.clinica_version() returns integer language sql stable as $$select 21$$;
notify pgrst,'reload schema';
commit;
