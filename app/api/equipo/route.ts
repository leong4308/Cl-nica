import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'

async function acceso() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a
  if (!['admin', 'medico', 'enfermero', 'recepcionista'].includes(a.usuario.rol)) return { respuesta: NextResponse.json({ error: 'No tienes acceso a la comunicación del equipo.' }, { status: 403 }) }
  return a
}
export async function GET() {
  const a = await acceso(); if (a.respuesta) return a.respuesta
  const r = await a.db.rpc('clinica_equipo_panel')
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await acceso(); if (a.respuesta) return a.respuesta
  const texto = await request.text()
  if (texto.length > 6000) return NextResponse.json({ error: 'El mensaje es demasiado extenso.' }, { status: 413 })
  let b; try { b = JSON.parse(texto) } catch { return NextResponse.json({ error: 'Revisa el mensaje.' }, { status: 400 }) }
  if (!b || !['enviar', 'responder', 'leer'].includes(b.accion) || !b.datos || typeof b.datos !== 'object' || Array.isArray(b.datos) || typeof b.clave !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.clave)) return NextResponse.json({ error: 'Revisa los datos del mensaje.' }, { status: 400 })
  const r = await a.db.rpc('clinica_equipo_operar', { p_accion: b.accion, p_datos: b.datos, p_clave: b.clave })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
