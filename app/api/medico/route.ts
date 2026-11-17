import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (!['admin', 'medico'].includes(a.usuario.rol)) return NextResponse.json({ error: 'Sin acceso a la consulta médica.' }, { status: 403 })
  const params = new URL(request.url).searchParams, cita = params.get('cita'), dia = params.get('dia')
  if (cita && (!/^\d+$/.test(cita) || !Number.isSafeInteger(Number(cita)) || Number(cita) < 1)) return NextResponse.json({ error: 'Cita inválida.' }, { status: 400 })
  if (!cita && a.usuario.rol !== 'medico') return NextResponse.json({ error: 'Selecciona la consulta desde la agenda administrativa.' }, { status: 403 })
  if (dia && (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isFinite(Date.parse(dia)) || new Date(dia).toISOString().slice(0, 10) !== dia)) return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 })
  const r = cita ? await a.db.rpc('clinica_consulta_leer', { p_cita: Number(cita) }) : await a.db.rpc('clinica_medico_panel', { p_dia: dia || null })
  return r.error ? errorOperacion(r.error) : NextResponse.json(cita ? { ...r.data, editorId: a.user?.id, esAdministrador: a.usuario.rol === 'admin' } : r.data, { headers })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (!['admin', 'medico'].includes(a.usuario.rol)) return NextResponse.json({ error: 'Sin acceso a la consulta médica.' }, { status: 403 })
  const texto = await request.text()
  if (texto.length > 52000) return NextResponse.json({ error: 'La consulta supera el límite de tamaño.' }, { status: 413 })
  let b
  try { b = JSON.parse(texto) } catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }) }
  if (!b || !['guardar', 'editar_admin', 'corregir', 'orden', 'revisar', 'solicitar_cambio'].includes(b.accion) || !b.datos || typeof b.datos !== 'object' || Array.isArray(b.datos) || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.clave ?? '') || !/^[a-f0-9]{32}$/.test(b.datos.version ?? '')) return NextResponse.json({ error: 'Revisa la acción y actualiza la consulta.' }, { status: 400 })
  if (b.accion === 'editar_admin') {
    if (a.usuario.rol !== 'admin') return NextResponse.json({ error: 'La edición administrativa requiere una cuenta de administrador.' }, { status: 403 })
    const r = await a.db.rpc('clinica_admin_editar_nota', { p_datos: b.datos, p_clave: b.clave })
    return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers })
  }
  const r = await a.db.rpc('clinica_medico_operar', { p_accion: b.accion, p_datos: b.datos, p_clave: b.clave })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers })
}
