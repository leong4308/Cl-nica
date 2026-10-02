import { createClient } from './client'
import type { RolUsuario } from './tipos-rol'

export type PerfilSesion = { nombre: string; rol: RolUsuario }

const NOMBRE_POR_DEFECTO: PerfilSesion = { nombre: 'Usuario', rol: 'paciente' }

export async function cargarPerfilSesion(): Promise<PerfilSesion> {
  const supabase = createClient()
  const { data: sesion } = await supabase.auth.getUser()
  const correo = sesion.user?.email
  if (!correo) return NOMBRE_POR_DEFECTO

  const { data } = await supabase
    .from('usuarios')
    .select('nombre_completo, rol')
    .eq('correo', correo.toLowerCase())
    .maybeSingle()

  if (!data) return NOMBRE_POR_DEFECTO
  return { nombre: data.nombre_completo, rol: data.rol as RolUsuario }
}

export async function cerrarSesion() {
  await createClient().auth.signOut()
}
