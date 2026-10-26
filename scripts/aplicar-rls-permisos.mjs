import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envRaw = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envRaw
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function aplicarRLS() {
  console.log('Aplicando políticas de seguridad en Supabase...')

  const sql = `
    -- 1. Políticas de eliminación: Solo 'admin' puede borrar citas, internaciones, ordenes, expedientes
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

    -- 2. Políticas de edición/actualización:
    -- Personal clínico (admin, medico, enfermero, recepcionista) puede actualizar según corresponda
    drop policy if exists expedientes_authenticated_update on public.expedientes;
    create policy expedientes_authenticated_update on public.expedientes
      for update to authenticated
      using (
        coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false)
      )
      with check (
        coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false)
      );

    drop policy if exists internaciones_staff_update on public.internaciones;
    create policy internaciones_staff_update on public.internaciones
      for update to authenticated
      using (
        coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false)
      )
      with check (
        coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false)
      );

    drop policy if exists ordenes_staff_update on public.ordenes_medicas;
    create policy ordenes_staff_update on public.ordenes_medicas
      for update to authenticated
      using (
        coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false)
      )
      with check (
        coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false)
      );

    drop policy if exists solicitudes_staff_update on public.solicitudes_analisis;
    create policy solicitudes_staff_update on public.solicitudes_analisis
      for update to authenticated
      using (
        coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false)
      )
      with check (
        coalesce((select rol in ('admin', 'medico', 'enfermero') from public.usuarios where auth_user_id = auth.uid()), false)
      );
  `

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => ({ error: { message: 'RPC exec_sql no configurada' } }))
  if (error) {
    console.log('Nota: El SQL para RLS está preparado en supabase/migraciones/politicas_permisos_roles.sql')
  } else {
    console.log('Políticas RLS aplicadas directamente en base de datos!')
  }
}

aplicarRLS().catch(console.error)
