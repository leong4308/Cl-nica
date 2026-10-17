import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const citaId = Number(body.citaId)

    if (!citaId || Number.isNaN(citaId)) {
      return NextResponse.json({ error: 'ID de cita inválido' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta (Supabase service key)' },
        { status: 500 }
      )
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const fila = {
      cita_id: citaId,
      diagnostico: typeof body.diagnostico === 'string' ? body.diagnostico.trim() || null : null,
      receta: typeof body.receta === 'string' ? body.receta.trim() || null : null,
      notas_doctor: typeof body.notas === 'string' ? body.notas.trim() || null : null,
    }

    const { data, error } = await admin
      .from('expedientes')
      .upsert(fila, { onConflict: 'cita_id' })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al guardar el expediente' },
      { status: 500 }
    )
  }
}
