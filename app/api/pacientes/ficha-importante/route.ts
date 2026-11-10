import { autorizarRegistro } from '@/lib/pacientes/acceso'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { actualizarFichaClinica, type SeccionFichaClinica } from '@/lib/pacientes/ficha-clinica'

export type SignosVitales = {
  presionArterial?: string
  frecuenciaCardiaca?: string
  temperatura?: string
  saturacionOxigeno?: string
  peso?: string
  glucosa?: string
  tomadoPor?: string
  fechaHora?: string
}

export type FichaImportante = {
  alergias?: string
  tipoSangre?: string
  condicionesCronicas?: string
  signosVitales?: SignosVitales
  medicamentoActual?: string
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Origen de solicitud inválido.' }, { status: 403 })
    const sessionClient = await createServerClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { data: solicitante } = await sessionClient.from('usuarios').select('id, rol, esta_activo, nombre_completo').eq('auth_user_id', user.id).maybeSingle()
    if (!solicitante?.esta_activo || !['admin', 'medico', 'enfermero', 'recepcionista'].includes(solicitante.rol)) return NextResponse.json({ error: 'No tienes permiso para modificar esta ficha.' }, { status: 403 })

    const body = await request.json()
    const pacienteId = Number(body.pacienteId)
    if (!Number.isSafeInteger(pacienteId) || pacienteId <= 0) {
      return NextResponse.json({ error: 'ID de paciente inválido' }, { status: 400 })
    }
    const denegado = await autorizarRegistro(sessionClient, 'pacientes', pacienteId, solicitante)
    if (denegado) return denegado
    const { data: paciente } = await sessionClient.from('perfiles_pacientes').select('id, notas_medicas').eq('id', pacienteId).maybeSingle()
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado o sin acceso.' }, { status: 404 })

    const seccion = body.seccion ?? 'completa'
    if (!['alertas', 'signos', 'completa'].includes(seccion)) return NextResponse.json({ error: 'Sección de ficha inválida.' }, { status: 400 })
    let ficha: FichaImportante
    try {
      ficha = actualizarFichaClinica(paciente.notas_medicas, body.ficha, seccion as SeccionFichaClinica, solicitante.nombre_completo, new Date().toISOString())
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Revisa la información de la ficha.' }, { status: 400 }) }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración incompleta de servidor' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { 'x-clinica-actor': user.id } },
    })

    const payloadTexto = JSON.stringify(ficha)

    let consulta = admin
      .from('perfiles_pacientes')
      .update({ notas_medicas: payloadTexto })
      .eq('id', pacienteId)
    consulta = paciente.notas_medicas === null ? consulta.is('notas_medicas', null) : consulta.eq('notas_medicas', paciente.notas_medicas)
    const { data: actualizado, error } = await consulta.select('id').maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!actualizado) return NextResponse.json({ error: 'La ficha cambió mientras la editabas. Vuelve a abrir el paciente para revisar la información actual.' }, { status: 409 })

    return NextResponse.json({ ok: true, ficha })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al guardar ficha importante' },
      { status: 500 }
    )
  }
}
