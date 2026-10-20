import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

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
    const sessionClient = await createServerClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const pacienteId = Number(body.pacienteId)
    if (!pacienteId || Number.isNaN(pacienteId)) {
      return NextResponse.json({ error: 'ID de paciente inválido' }, { status: 400 })
    }

    const ficha: FichaImportante = body.ficha ?? {}

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración incompleta de servidor' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const payloadTexto = JSON.stringify(ficha)

    const { error } = await admin
      .from('perfiles_pacientes')
      .update({ notas_medicas: payloadTexto })
      .eq('id', pacienteId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ficha })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al guardar ficha importante' },
      { status: 500 }
    )
  }
}
