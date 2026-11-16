import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  const cita = new URL(request.url).searchParams.get('cita')
  if (cita) {
    if (!['admin', 'recepcionista', 'medico', 'enfermero'].includes(a.usuario.rol)) return NextResponse.json({ error: 'Sin acceso a recepción.' }, { status: 403 })
    if (!/^\d+$/.test(cita) || !Number.isSafeInteger(Number(cita)) || Number(cita) < 1) return NextResponse.json({ error: 'Cita inválida.' }, { status: 400 })
    const r = await a.db.rpc('clinica_recepcion_estado', { p_cita: Number(cita) })
    return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers })
  }
  if (!['admin', 'recepcionista'].includes(a.usuario.rol)) return NextResponse.json({ error: 'Sin acceso a recepción.' }, { status: 403 })
  const dia = new URL(request.url).searchParams.get('dia')
  if (dia && (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isFinite(Date.parse(dia)) || new Date(dia).toISOString().slice(0, 10) !== dia)) return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 })
  const r = await a.db.rpc('clinica_recepcion_panel', { p_dia: dia || null })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (!['admin', 'recepcionista', 'medico'].includes(a.usuario.rol)) return NextResponse.json({ error: 'Sin acceso a recepción.' }, { status: 403 })
  const texto = await request.text()
  if (texto.length > 4000) return NextResponse.json({ error: 'Solicitud demasiado extensa.' }, { status: 413 })
  let b
  try { b = JSON.parse(texto) } catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }) }
  if (!b || !Number.isSafeInteger(b.citaId) || b.citaId < 1 || !/^[a-f0-9]{32}$/.test(b.version ?? '') || !['llegada', 'iniciar', 'confirmar', 'cancelar', 'no_asistio'].includes(b.accion) || (b.motivo != null && (typeof b.motivo !== 'string' || b.motivo.length > 1000)) || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.clave ?? '')) return NextResponse.json({ error: 'Revisa la cita y la acción.' }, { status: 400 })
  const r = await a.db.rpc('clinica_recepcion_operar', { p_cita: b.citaId, p_version: b.version, p_accion: b.accion, p_motivo: b.motivo ?? null, p_clave: b.clave })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers })
}
