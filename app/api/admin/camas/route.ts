import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo administración gestiona habitaciones y camas.' }, { status: 403 })
  const r = await a.db.rpc('clinica_catalogo_camas')
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo administración gestiona habitaciones y camas.' }, { status: 403 })
  const texto = await request.text()
  if (texto.length > 6500) return NextResponse.json({ error: 'La solicitud es demasiado extensa.' }, { status: 413 })
  let b
  try { b = JSON.parse(texto) } catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }) }
  if (!b || !['crear_habitacion', 'editar_habitacion', 'estado_habitacion', 'crear_cama', 'editar_cama', 'estado_cama'].includes(b.accion) || !b.datos || typeof b.datos !== 'object' || Array.isArray(b.datos) || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.clave ?? '')) return NextResponse.json({ error: 'Revisa la acción y los datos del catálogo.' }, { status: 400 })
  const r = await a.db.rpc('clinica_catalogo_camas_operar', { p_accion: b.accion, p_datos: b.datos, p_clave: b.clave })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers })
}
