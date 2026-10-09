import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

type CuerpoPaciente = {
  nombre?: string
  correo?: string
  telefono?: string
  fechaNacimiento?: string
  genero?: string
  contactoEmergencia?: string
  telefonoEmergencia?: string
  notasMedicas?: string
}

export async function POST(request: Request) {
  const sessionClient = await createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = (await request.json()) as CuerpoPaciente
  const nombre = body.nombre?.trim()
  if (!nombre) {
    return NextResponse.json({ error: 'El nombre completo es obligatorio.' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const emailRaw = body.correo?.trim().toLowerCase()
  const correo = emailRaw && emailRaw.includes('@')
    ? emailRaw
    : `paciente_${Date.now()}_${Math.floor(Math.random() * 1000)}@clinica.local`

  const { data: usuario, error: errUsuario } = await admin
    .from('usuarios')
    .insert({
      correo,
      nombre_completo: nombre,
      telefono: body.telefono?.trim() || null,
      rol: 'paciente',
      esta_activo: true,
    })
    .select('id, nombre_completo')
    .single()

  if (errUsuario || !usuario) {
    return NextResponse.json({ error: `Error al crear usuario: ${errUsuario?.message || 'desconocido'}` }, { status: 500 })
  }

  const { data: perfil, error: errPerfil } = await admin
    .from('perfiles_pacientes')
    .insert({
      usuario_id: usuario.id,
      fecha_nacimiento: body.fechaNacimiento || null,
      genero: body.genero || null,
      nombre_contacto_emergencia: body.contactoEmergencia?.trim() || null,
      telefono_emergencia: body.telefonoEmergencia?.trim() || null,
      notas_medicas: body.notasMedicas?.trim() || null,
      esta_activo: true,
    })
    .select('id')
    .single()

  if (errPerfil || !perfil) {
    return NextResponse.json({ error: `Error al crear perfil de paciente: ${errPerfil?.message || 'desconocido'}` }, { status: 500 })
  }

  return NextResponse.json({ id: perfil.id, nombre: usuario.nombre_completo })
}
