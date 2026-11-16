import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
import { configuracionCorreo } from '@/lib/notificaciones/correo.mjs'
import { datosGestion, fechaValida, ROLES_GESTION, UUID, type ModuloGestion } from '@/lib/gestion/modelo'
type Contexto = { params: Promise<{ modulo: string }> }
const headers = { 'Cache-Control': 'private, no-store' }
async function acceso(contexto: Contexto) {
  const a = await cuentaAutenticada()
  if (a.respuesta) return { respuesta: a.respuesta } as const
  const modulo = (await contexto.params).modulo as ModuloGestion
  if (!Object.hasOwn(ROLES_GESTION, modulo) || !ROLES_GESTION[modulo].includes(a.usuario.rol)) return { respuesta: NextResponse.json({ error: 'No tienes acceso a este módulo.' }, { status: 403 }) } as const
  return { ...a, modulo } as const
}
export async function GET(request: Request, contexto: Contexto) {
  const a = await acceso(contexto)
  if (a.respuesta) return a.respuesta
  const q = new URL(request.url).searchParams
  for (const k of ['desde', 'hasta']) if (q.has(k) && !fechaValida(q.get(k))) return NextResponse.json({ error: 'Selecciona una fecha válida.' }, { status: 400 })
  for (const k of ['entrada', 'medico']) if (q.has(k) && (!/^\d+$/.test(q.get(k)!) || !Number.isSafeInteger(Number(q.get(k))) || Number(q.get(k)) < 1)) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 })
  let r
  if (a.modulo === 'envios') r = await a.db.rpc('clinica_envios_panel', { p_estado: q.get('estado') || null, p_canal: q.get('canal') || null })
  else if (a.modulo === 'espera') r = await a.db.rpc('clinica_espera_panel', { p_entrada: q.has('entrada') ? Number(q.get('entrada')) : null, p_desde: q.get('desde') || null })
  else if (a.modulo === 'consultorios') r = await a.db.rpc('clinica_consultorios_panel')
  else if (a.modulo === 'controles') r = await a.db.rpc('clinica_controles_panel')
  else r = await a.db.rpc('clinica_reportes_panel', { p_desde: q.get('desde'), p_hasta: q.get('hasta'), p_medico: q.has('medico') ? Number(q.get('medico')) : null })
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json(a.modulo === 'envios' ? { ...r.data, correoConfigurado: Boolean(configuracionCorreo()), correoPrueba: /@resend\.dev\b/i.test(process.env.EMAIL_FROM ?? ''), telegramConfigurado: Boolean(process.env.TELEGRAM_BOT_TOKEN) } : r.data, { headers })
}
export async function POST(request: Request, contexto: Contexto) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await acceso(contexto)
  if (a.respuesta) return a.respuesta
  const texto = await request.text()
  if (texto.length > 6500) return NextResponse.json({ error: 'Solicitud demasiado extensa.' }, { status: 413 })
  let b, datos
  try { b = JSON.parse(texto); if (!UUID.test(b?.clave ?? '') || typeof b?.accion !== 'string') throw Error('Solicitud inválida.'); datos = datosGestion(a.modulo, b.accion, b.datos, a.usuario.rol) } catch (e) { return NextResponse.json({ error: (e as Error).message || 'Revisa los campos.' }, { status: 400 }) }
  const r = await a.db.rpc('clinica_operar_modulo', { p_modulo: a.modulo, p_accion: b.accion, p_datos: datos, p_clave: b.clave })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers })
}
