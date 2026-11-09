import { createClient } from './client'
import type { RolUsuario } from './tipos-rol'
import { normalizarPreferencias, type PreferenciasUsuario } from '@/lib/cuenta/preferencias'

export type PerfilSesion = {
  usuarioId?: number
  nombre: string
  rol: RolUsuario
  medicoId?: number
  clinicaId?: number
  preferencias?: PreferenciasUsuario
}

export async function cargarPerfilSesion(): Promise<PerfilSesion> {
  const supabase = createClient()
  const { data: sesion } = await supabase.auth.getUser()
  const user = sesion.user
  if (!user) throw new Error('No hay una sesión activa.')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, rol, esta_activo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!usuario || usuario.esta_activo === false) throw new Error('No se encontró un perfil activo para esta cuenta.')

  let medicoId: number | undefined
  let clinicaId: number | undefined

  if (usuario.rol === 'medico') {
    const { data: perfilMedico } = await supabase
      .from('perfiles_medicos')
      .select('id, clinica_id')
      .eq('usuario_id', usuario.id)
      .maybeSingle()

    if (perfilMedico) {
      medicoId = perfilMedico.id
      clinicaId = perfilMedico.clinica_id
    }
  }

  return {
    usuarioId: usuario.id,
    nombre: usuario.nombre_completo,
    rol: usuario.rol as RolUsuario,
    medicoId,
    clinicaId,
    preferencias: normalizarPreferencias(user.user_metadata?.clinica_preferencias, usuario.rol as RolUsuario),
  }
}

export async function cerrarSesion() {
  const { error } = await createClient().auth.signOut({ scope: 'local' })
  if (error) throw error
}
