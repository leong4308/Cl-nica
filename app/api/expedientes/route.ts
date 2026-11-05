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

    const fila: Record<string, unknown> = {
      diagnostico: typeof body.diagnostico === 'string' ? body.diagnostico.trim() || null : null,
      receta: typeof body.receta === 'string' ? body.receta.trim() || null : null,
      notas_doctor: typeof body.notas === 'string' ? body.notas.trim() || null : null,
    }

    const expedienteId = Number(body.id)
    if (expedienteId && !Number.isNaN(expedienteId)) {
      const { data, error } = await admin
        .from('expedientes')
        .update(fila)
        .eq('id', expedienteId)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, data })
    }

    const filaConCita = { ...fila, cita_id: citaId }
    const { data, error } = await admin
      .from('expedientes')
      .upsert(filaConCita, { onConflict: 'cita_id' })
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID de expediente inválido' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error } = await admin.from('expedientes').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al eliminar el expediente' },
      { status: 500 }
    )
  }
}
