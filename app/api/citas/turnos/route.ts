import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
import { instanteClinica } from '@/lib/agenda/modelo'

const seleccionValida = (id: unknown, version: unknown) => (typeof id === 'number' || typeof id === 'string' && /^\d+$/.test(id)) && Number.isSafeInteger(Number(id)) && Number(id) > 0 && typeof version === 'string' && /^[a-f0-9]{32}$/.test(version)
export async function GET(request: Request) {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'paciente') return NextResponse.json({ error: 'Solo el paciente puede elegir turnos de sus citas.' }, { status: 403 })
  const q = new URL(request.url).searchParams, id = q.get('citaId'), version = q.get('version'), desde = q.get('desde')
  if (!seleccionValida(id, version)) return NextResponse.json({ error: 'Actualiza los datos de tu cita.' }, { status: 400 })
  if (desde) try { instanteClinica(desde,'00:00') } catch { return NextResponse.json({ error: 'Selecciona una fecha válida.' }, { status: 400 }) }
  const r = await a.db.rpc('clinica_turnos_cita', { p_cita: Number(id), p_version: version, p_desde: desde || null })
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'paciente') return NextResponse.json({ error: 'Solo el paciente puede elegir turnos de sus citas.' }, { status: 403 })
  const b = await request.json().catch(() => null)
  if (!b || !seleccionValida(b.citaId,b.version) || typeof b.inicio !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(b.inicio) || !Number.isFinite(Date.parse(b.inicio))) return NextResponse.json({ error: 'Selecciona un horario disponible.' }, { status: 400 })
  const r = await a.db.rpc('clinica_reagendar_turno', { p_cita: Number(b.citaId), p_version: b.version, p_inicio: b.inicio })
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
