import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'

export async function GET() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  const r = await a.db.rpc('clinica_listar_cambios_cita')
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json({ solicitudes: r.data }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'paciente') return NextResponse.json({ error: 'Solo el paciente puede responder por su asistencia.' }, { status: 403 })
  const b = await request.json().catch(() => null)
  if (!b || !Number.isSafeInteger(b.citaId) || b.citaId < 1 || !/^[a-f0-9]{32}$/.test(b.version ?? '') || !['confirmar', 'cancelar', 'reagendar'].includes(b.accion) || (b.disponibilidad != null && typeof b.disponibilidad !== 'string')) return NextResponse.json({ error: 'Actualiza tu cita y revisa la respuesta.' }, { status: 400 })
  if (b.accion === 'cancelar' && b.confirmado !== true) return NextResponse.json({ error: 'Confirma que deseas cancelar tu cita.' }, { status: 400 })
  const r = await a.db.rpc('clinica_responder_cita', { p_cita: b.citaId, p_version: b.version, p_accion: b.accion, p_disponibilidad: b.disponibilidad ?? null })
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (!['admin', 'recepcionista'].includes(a.usuario.rol)) return NextResponse.json({ error: 'Solo recepción puede atender solicitudes.' }, { status: 403 })
  const b = await request.json().catch(() => null)
  if (!b || !Number.isSafeInteger(b.id) || b.id < 1 || typeof b.respuesta !== 'string') return NextResponse.json({ error: 'Selecciona una solicitud y escribe tu respuesta.' }, { status: 400 })
  const r = await a.db.rpc('clinica_cerrar_cambio_cita', { p_id: b.id, p_respuesta: b.respuesta })
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json({ ok: true })
}
