import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'

export async function GET() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  const [filas, cuenta] = await Promise.all([
    a.db.from('notificaciones').select('id,tipo,titulo,mensaje,cita_id,creado_en,leida_en').eq('usuario_id', a.usuario.id).order('id', { ascending: false }).limit(50),
    a.db.from('notificaciones').select('id', { count: 'exact', head: true }).eq('usuario_id', a.usuario.id).is('leida_en', null),
  ])
  const error = filas.error ?? cuenta.error
  if (error) return errorOperacion(error)
  return NextResponse.json({ notificaciones: filas.data, sinLeer: cuenta.count ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  const b = await request.json().catch(() => null)
  if (!b || (!Number.isSafeInteger(b.id) && b.todas !== true)) return NextResponse.json({ error: 'Selecciona una notificación.' }, { status: 400 })
  let q = a.db.from('notificaciones').update({ leida_en: new Date().toISOString() }).eq('usuario_id', a.usuario.id).is('leida_en', null)
  if (b.todas !== true) q = q.eq('id', b.id)
  else {
    if (!Number.isSafeInteger(b.hasta) || b.hasta < 1) return NextResponse.json({ error: 'Actualiza las notificaciones.' }, { status: 400 })
    q = q.lte('id', b.hasta) // No marca como leídos avisos que llegaron después de abrir el panel.
  }
  const r = await q
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json({ ok: true })
}
