import { errorOperacion } from '@/lib/supabase/error-operacion'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { validarNombreTelefono, validarNacimiento, validarContactoEmergencia, correoValido } from '@/lib/cuenta/validacion'
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

  const body = (await request.json().catch(() => null)) as CuerpoPaciente | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Revisa los datos del paciente.' }, { status: 400 })
  const errorDatos = validarNombreTelefono(body.nombre, body.telefono) || validarContactoEmergencia(body.contactoEmergencia, body.telefonoEmergencia)
  if (errorDatos) return NextResponse.json({ error: errorDatos }, { status: 400 })
  if (!validarNacimiento(body.fechaNacimiento)) return NextResponse.json({ error: 'La fecha de nacimiento debe estar entre 1900 y hoy.' }, { status: 400 })
  if (body.correo && !correoValido(body.correo)) return NextResponse.json({ error: 'Escribe un correo electrónico válido de hasta 150 caracteres.' }, { status: 400 })
  if (body.genero && !['M', 'F', 'O'].includes(body.genero)) return NextResponse.json({ error: 'Selecciona un género válido.' }, { status: 400 })
  if (body.notasMedicas !== undefined && (typeof body.notasMedicas !== 'string' || body.notasMedicas.length > 8000)) return NextResponse.json({ error: 'Las notas admiten hasta 8000 caracteres.' }, { status: 400 })
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  if (!nombre) {
    return NextResponse.json({ error: 'El nombre completo es obligatorio.' }, { status: 400 })
  }

  const resultado = await sessionClient.rpc('clinica_registrar_paciente', { p_datos: body })
  return resultado.error ? errorOperacion(resultado.error) : NextResponse.json(resultado.data)
}
