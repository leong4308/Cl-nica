import { errorOperacion } from '@/lib/supabase/error-operacion'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { listarPacientes } from '@/lib/pacientes/listado'

export async function GET() {
  try {
    const acceso = await cuentaAutenticada()
    if (acceso.respuesta) return acceso.respuesta
    if (!['admin', 'medico', 'enfermero', 'recepcionista'].includes(acceso.usuario.rol)) return NextResponse.json({ error: 'No tienes permiso para consultar el directorio.' }, { status: 403 })
    const pacientes = await listarPacientes(acceso.db, acceso.usuario)
    return NextResponse.json({ pacientes }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo cargar el directorio de pacientes.' }, { status: 500 })
  }
}

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
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const sessionClient = await createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: solicitante } = await sessionClient.from('usuarios').select('rol, esta_activo').eq('auth_user_id', user.id).maybeSingle()
  if (!solicitante?.esta_activo || !['admin', 'medico', 'enfermero', 'recepcionista'].includes(solicitante.rol)) return NextResponse.json({ error: 'No tienes permiso para registrar pacientes.' }, { status: 403 })

  const body = (await request.json()) as CuerpoPaciente
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  if (!nombre) {
    return NextResponse.json({ error: 'El nombre completo es obligatorio.' }, { status: 400 })
  }

  const resultado = await sessionClient.rpc('clinica_registrar_paciente', { p_datos: body })
  return resultado.error ? errorOperacion(resultado.error) : NextResponse.json(resultado.data)
}
