import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
import { instanteClinica } from '@/lib/agenda/modelo'

const headers = { 'Cache-Control': 'private, no-store' }
const medicoValido = (v: unknown) => (typeof v === 'number' || typeof v === 'string' && /^\d+$/.test(v)) && Number.isSafeInteger(Number(v)) && Number(v) > 0
export async function GET(request: Request) {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'paciente') return NextResponse.json({ error: 'Esta opción es exclusiva del paciente.' }, { status: 403 })
  const q = new URL(request.url).searchParams, medico = q.get('medico'), desde = q.get('desde')
  if (medico !== null && !medicoValido(medico)) return NextResponse.json({ error: 'Selecciona un médico.' }, { status: 400 })
  if (desde) try { instanteClinica(desde, '00:00') } catch { return NextResponse.json({ error: 'Selecciona una fecha válida.' }, { status: 400 }) }
  const r = await a.db.rpc('clinica_agenda_reserva', { p_medico: medico === null ? null : Number(medico), p_desde: desde || null })
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json(r.data, { headers })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'paciente') return NextResponse.json({ error: 'Esta opción es exclusiva del paciente.' }, { status: 403 })
  const b = await request.json().catch(() => null)
  const instante = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
  if (!b || !medicoValido(b.medico) || !instante(b.inicio) || !instante(b.fin) || Date.parse(b.fin) <= Date.parse(b.inicio) || typeof b.clave !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.clave) || b.motivo != null && (typeof b.motivo !== 'string' || b.motivo.length > 1000)) return NextResponse.json({ error: 'Selecciona un horario válido y un motivo de hasta 1000 caracteres.' }, { status: 400 })
  // La identidad proviene del JWT en SQL; nunca se acepta un paciente enviado por el navegador.
  const r = await a.db.rpc('clinica_agendar_paciente', { p_medico: Number(b.medico), p_inicio: b.inicio, p_fin: b.fin, p_clave: b.clave, p_motivo: b.motivo || null })
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json(r.data, { headers })
}
