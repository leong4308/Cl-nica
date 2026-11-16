import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'

const cabeceras = { 'Cache-Control': 'private, no-store' }
export async function GET() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (!['admin', 'medico', 'enfermero'].includes(a.usuario.rol)) return NextResponse.json({ error: 'No tienes acceso a enfermería.' }, { status: 403 })
  const r = await a.db.rpc('clinica_enfermeria_panel')
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers: cabeceras })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (!['admin', 'medico', 'enfermero'].includes(a.usuario.rol)) return NextResponse.json({ error: 'No tienes acceso a enfermería.' }, { status: 403 })
  if (Number(request.headers.get('content-length')) > 24000) return NextResponse.json({ error: 'La solicitud es demasiado extensa.' }, { status: 413 })
  const b = await request.json().catch(() => null)
  const acciones = ['asignar', 'retirar_turno', 'contacto', 'nota', 'incidencia', 'entrega', 'correccion', 'signos', 'programar', 'cumplir', 'anular_tarea', 'orden_estado', 'muestra', 'llegada', 'acusar', 'autorizar', 'movimiento']
  if (!b || !acciones.includes(b.accion) || !b.datos || typeof b.datos !== 'object' || Array.isArray(b.datos) || JSON.stringify(b.datos).length > 20000 || typeof b.clave !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.clave)) return NextResponse.json({ error: 'Revisa los datos del registro.' }, { status: 400 })
  const r = await a.db.rpc('clinica_enfermeria_operar', { p_accion: b.accion, p_datos: b.datos, p_clave: b.clave })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers: cabeceras })
}
