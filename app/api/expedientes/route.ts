import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function autorizar(soloAdmin = false) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { respuesta: NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 }) } as const
  const { data: perfil } = await db.from('usuarios').select('rol, esta_activo').eq('auth_user_id', user.id).maybeSingle()
  if (!perfil?.esta_activo || !(soloAdmin ? ['admin'] : ['admin', 'medico']).includes(perfil.rol)) return { respuesta: NextResponse.json({ error: 'No tienes permiso para modificar expedientes.' }, { status: 403 }) } as const
  return { db } as const
}

export async function POST(request: Request) {
  try {
    const acceso = await autorizar()
    if ('respuesta' in acceso) return acceso.respuesta
    const admin = acceso.db
    const body = await request.json()
    const citaId = Number(body.citaId)

    const expedienteId = Number(body.id)
    if ((!Number.isSafeInteger(expedienteId) || expedienteId <= 0) && (!Number.isSafeInteger(citaId) || citaId <= 0)) {
      return NextResponse.json({ error: 'ID de cita inválido' }, { status: 400 })
    }

    const fila: Record<string, unknown> = {
      diagnostico: typeof body.diagnostico === 'string' ? body.diagnostico.trim() || null : null,
      receta: typeof body.receta === 'string' ? body.receta.trim() || null : null,
      notas_doctor: typeof body.notas === 'string' ? body.notas.trim() || null : null,
    }

    if (expedienteId && !Number.isNaN(expedienteId)) {
      const { data, error } = await admin
        .from('expedientes')
        .update(fila)
        .eq('id', expedienteId)
        .select()

      if (error || !data?.length) {
        return NextResponse.json({ error: error?.message || 'No se pudo actualizar el expediente.' }, { status: 400 })
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
    const acceso = await autorizar(true)
    if ('respuesta' in acceso) return acceso.respuesta
    const admin = acceso.db
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID de expediente inválido' }, { status: 400 })
    }

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
