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

export async function POST(request: Request) {
  const sessionClient = await createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

  // Solo un administrador puede crear cuentas de personal.
  const { data: solicitante } = await admin
    .from('usuarios')
    .select('rol')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (solicitante?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo un administrador puede crear cuentas de personal.' }, { status: 403 })
  }

  const body = await request.json() as CuerpoUsuario
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const nombre = body.nombre?.trim()
  const rol = body.rol?.trim() || 'medico'
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
  const { data: fila } = await admin.from('usuarios').select('id').eq('auth_user_id', usuarioId).maybeSingle()
  if (!fila) return NextResponse.json({ error: 'El usuario se creó, pero no se pudo localizar su perfil.' }, { status: 500 })

  if (rol === 'medico') {
    const { data: clinica } = await admin.from('clinicas').select('id').order('id').limit(1).maybeSingle()
    if (clinica) {
      const { error: errorMedico } = await admin.from('perfiles_medicos').insert({
        usuario_id: fila.id,
        clinica_id: clinica.id,
        especialidad: body.especialidad!.trim(),
        cedula_profesional: body.cedula!.trim(),
        duracion_consulta: Number(body.duracion) > 0 ? Number(body.duracion) : 20,
      })
      if (errorMedico) return NextResponse.json({ error: `Usuario creado, pero falló el perfil médico: ${errorMedico.message}` }, { status: 500 })
    }
  }

  if (rol === 'enfermero') {
    const { data: clinica } = await admin.from('clinicas').select('id').order('id').limit(1).maybeSingle()
    if (clinica) {
      await admin.from('perfiles_enfermeros').insert({ usuario_id: fila.id, clinica_id: clinica.id, especialidad: body.especialidad?.trim() || null })
    }
  }

  if (body.telefono?.trim()) {
    await admin.from('usuarios').update({ telefono: body.telefono.trim() }).eq('id', fila.id)
  }

  return NextResponse.json({ id: data.user.id, email: data.user.email })
}
