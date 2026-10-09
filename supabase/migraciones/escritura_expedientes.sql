drop policy if exists expedientes_authenticated_insert on public.expedientes;
create policy expedientes_authenticated_insert on public.expedientes
  for insert to authenticated with check (true);

drop policy if exists expedientes_authenticated_update on public.expedientes;
create policy expedientes_authenticated_update on public.expedientes
  for update to authenticated using (true) with check (true);

