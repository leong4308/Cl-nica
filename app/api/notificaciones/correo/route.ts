import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
import { configuracionCorreo } from '@/lib/notificaciones/correo.mjs'
export async function GET() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  const r = await a.db.rpc('clinica_preferencias_correo')
  return r.error ? errorOperacion(r.error) : NextResponse.json({ ...r.data, configurado: Boolean(configuracionCorreo()) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function PATCH(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  let b
  try { b = JSON.parse((await request.text()).slice(0, 1000)) } catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }) }
  if (typeof b?.activo !== 'boolean') return NextResponse.json({ error: 'Selecciona tu preferencia.' }, { status: 400 })
  const r = await a.db.rpc('clinica_preferencias_correo', { p_activo: b.activo })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
