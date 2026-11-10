import { origenValido } from '@/lib/cuenta/servidor'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

type CuerpoUsuario = {
  email?: string
  password?: string
  nombre?: string
  rol?: string
  especialidad?: string
  cedula?: string
  duracion?: string
  fechaNacimiento?: string
  genero?: string
  telefono?: string
}

export async function GET() {
  const sessionClient = await createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { 'x-clinica-actor': user.id } } })

  const { data: solicitante } = await admin
    .from('usuarios')
    .select('rol, esta_activo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (solicitante?.rol !== 'admin' || !solicitante?.esta_activo) {
    return NextResponse.json({ error: 'Solo un administrador puede ver y gestionar usuarios.' }, { status: 403 })
  }

  const { data: usuarios, error } = await admin
    .from('usuarios')
    .select('id, auth_user_id, correo, nombre_completo, telefono, rol, esta_activo, creado_en, perfiles_medicos(id, especialidad, cedula_profesional, duracion_consulta, esta_activo), perfiles_enfermeros(id, especialidad, esta_activo)')
    .order('id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ usuarios })
}

export async function PATCH(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const sessionClient = await createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { 'x-clinica-actor': user.id } } })

  const { data: solicitante } = await admin
    .from('usuarios')
    .select('rol, esta_activo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (solicitante?.rol !== 'admin' || !solicitante?.esta_activo) {
    return NextResponse.json({ error: 'Solo un administrador puede modificar usuarios.' }, { status: 403 })
  }

  const { id, esta_activo, nombre, rol, telefono } = await request.json() as {
    id: number
    esta_activo?: boolean
    nombre?: string
    rol?: string
    telefono?: string
  }

  if (!id) return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (esta_activo !== undefined) updates.esta_activo = Boolean(esta_activo)
  if (nombre) updates.nombre_completo = nombre.trim()
  if (rol && !['admin','medico','recepcionista','enfermero','paciente'].includes(rol.trim())) return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
  if (rol) updates.rol = rol.trim()
  if (telefono !== undefined) updates.telefono = telefono.trim()

  const { error } = await admin.from('usuarios').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const sessionClient = await createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { 'x-clinica-actor': user.id } } })

  const { data: solicitante } = await admin
    .from('usuarios')
    .select('rol, esta_activo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (solicitante?.rol !== 'admin' || !solicitante?.esta_activo) {
    return NextResponse.json({ error: 'Solo un administrador puede crear cuentas de personal.' }, { status: 403 })
  }

  const body = await request.json() as CuerpoUsuario
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const nombre = body.nombre?.trim()
  const rol = body.rol?.trim() || 'medico'
  if (!['admin','medico','recepcionista','enfermero'].includes(rol)) return NextResponse.json({ error: 'Rol de personal inválido.' }, { status: 400 })
  if (rol === 'medico' && body.duracion && (!Number.isInteger(Number(body.duracion)) || Number(body.duracion) < 5 || Number(body.duracion) > 240)) return NextResponse.json({ error: 'La duración de consulta debe estar entre 5 y 240 minutos.' }, { status: 400 })
  if (!email || !password || !nombre || password.length < 6) {
    return NextResponse.json({ error: 'Nombre, correo y una contraseña de al menos 6 caracteres son obligatorios.' }, { status: 400 })
  }
  if (rol === 'medico' && !body.especialidad?.trim()) {
    return NextResponse.json({ error: 'Para registrar un médico debes indicar su especialidad.' }, { status: 400 })
  }
  if (rol === 'medico' && !body.cedula?.trim()) {
    return NextResponse.json({ error: 'Para registrar un médico debes indicar su cédula profesional.' }, { status: 400 })
  }

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre_completo: nombre, rol } })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const usuarioId = data.user.id
  async function revertir(mensaje: string) {
    const desactivada = await admin.from('usuarios').update({ esta_activo: false }).eq('auth_user_id', usuarioId)
    const borrado = await admin.auth.admin.deleteUser(usuarioId)
    return NextResponse.json({ error: borrado.error ? (desactivada.error ? 'No se completó el registro. La cuenta requiere revisión administrativa.' : 'La cuenta quedó inactiva y requiere revisión administrativa.') : mensaje }, { status: 400 })
  }
  const { data: fila } = await admin.from('usuarios').select('id').eq('auth_user_id', usuarioId).maybeSingle()
  if (!fila) return revertir('No se pudo crear el perfil. No se completó el registro.')
  const configurada = await admin.from('usuarios').update({ nombre_completo: nombre, rol, esta_activo: false, telefono: body.telefono?.trim() || null }).eq('id', fila.id)
  if (configurada.error) return revertir('No se pudo configurar la cuenta.')
  if (rol === 'medico' || rol === 'enfermero') {
    const { data: clinica } = await admin.from('clinicas').select('id').eq('esta_activo', true).order('id').limit(1).maybeSingle()
    if (!clinica) return revertir('Registra una clínica activa antes de crear personal clínico.')
    const tabla = rol === 'medico' ? 'perfiles_medicos' : 'perfiles_enfermeros'
    const existente = await admin.from(tabla).select('id').eq('usuario_id', fila.id).eq('clinica_id', clinica.id).maybeSingle()
    const perfil: Record<string, unknown> = rol === 'medico' ? { usuario_id: fila.id, clinica_id: clinica.id, especialidad: body.especialidad!.trim(), cedula_profesional: body.cedula!.trim(), duracion_consulta: Number(body.duracion) || 20, esta_activo: true } : { usuario_id: fila.id, clinica_id: clinica.id, especialidad: body.especialidad?.trim() || null, esta_activo: true }
    const guardado = existente.data ? await admin.from(tabla).update(perfil).eq('id', existente.data.id) : await admin.from(tabla).insert(perfil)
    if (guardado.error) return revertir(guardado.error.code === '23505' ? 'La cédula o el perfil ya están registrados.' : 'No se pudo crear el perfil profesional.')
  }
  const activa = await admin.from('usuarios').update({ esta_activo: true }).eq('id', fila.id)
  if (activa.error) return revertir('No se pudo activar la cuenta.')

  return NextResponse.json({ id: data.user.id, email: data.user.email })
}
