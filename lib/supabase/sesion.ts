import { createClient } from './client'
import type { RolUsuario } from './tipos-rol'

export type PerfilSesion = {
  usuarioId?: number
  nombre: string
  rol: RolUsuario
  medicoId?: number
  clinicaId?: number
}

const NOMBRE_POR_DEFECTO: PerfilSesion = { nombre: 'Usuario', rol: 'paciente' }

export async function cargarPerfilSesion(): Promise<PerfilSesion> {
  const supabase = createClient()
  const { data: sesion } = await supabase.auth.getUser()
  const correo = sesion.user?.email
  if (!correo) return NOMBRE_POR_DEFECTO

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, rol')
    .eq('correo', correo.toLowerCase())
    .maybeSingle()

  if (!usuario) return NOMBRE_POR_DEFECTO

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
  }
}

export async function cerrarSesion() {
  await createClient().auth.signOut()
}
