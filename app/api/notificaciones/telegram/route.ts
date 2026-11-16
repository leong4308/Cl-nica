import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { hashVinculo, nombreBot } from '@/lib/notificaciones/telegram.mjs'

function servicio() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
}
export async function GET() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  const db = servicio()
  const [cuenta, pendiente] = await Promise.all([
    db.from('telegram_cuentas').select('nombre,activo').eq('usuario_id', a.usuario.id).maybeSingle(),
    db.from('telegram_vinculos').select('id,nombre').eq('usuario_id', a.usuario.id).is('confirmado_en', null).not('chat_id', 'is', null).gt('vence_en', new Date().toISOString()).order('vence_en', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (cuenta.error || pendiente.error) return NextResponse.json({ error: 'No se pudo consultar la vinculación.' }, { status: 503 })
  return NextResponse.json({ configurado: !!process.env.TELEGRAM_BOT_TOKEN && !!nombreBot(process.env.TELEGRAM_BOT_USERNAME), conectado: cuenta.data?.activo === true, nombre: cuenta.data?.nombre ?? null, pendiente: pendiente.data }, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  const b = await request.json().catch(() => null)
  const db = servicio()
  if (b?.accion === 'desvincular') {
    // Desactiva primero: el trabajador comprueba de nuevo el consentimiento antes de enviar.
    const r = await db.from('telegram_cuentas').update({ activo: false }).eq('usuario_id', a.usuario.id)
    if (r.error) return NextResponse.json({ error: 'No se pudo desvincular Telegram.' }, { status: 503 })
    const expirado = await db.from('telegram_vinculos').update({ vence_en: new Date().toISOString() }).eq('usuario_id', a.usuario.id).is('confirmado_en', null)
    if (expirado.error) return NextResponse.json({ error: 'Se desactivaron los avisos. Reintenta para cerrar las solicitudes pendientes.' }, { status: 503 })
    return NextResponse.json({ ok: true })
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !nombreBot(process.env.TELEGRAM_BOT_USERNAME)) return NextResponse.json({ error: 'Administración todavía no ha configurado el bot.' }, { status: 503 })
  if (b?.accion === 'vincular') {
    const existentes = await db.from('telegram_vinculos').select('id', { count: 'exact', head: true }).eq('usuario_id', a.usuario.id).gt('vence_en', new Date().toISOString())
    if (existentes.error) return NextResponse.json({ error: 'No se pudo preparar el enlace.' }, { status: 503 })
    if ((existentes.count ?? 0) >= 5) return NextResponse.json({ error: 'Ya solicitaste varios enlaces. Espera diez minutos antes de generar otro.' }, { status: 429 })
    const token = randomBytes(32).toString('base64url')
    const r = await db.from('telegram_vinculos').insert({ usuario_id: a.usuario.id, token_hash: hashVinculo(token), vence_en: new Date(Date.now() + 600_000).toISOString() })
    if (r.error) return NextResponse.json({ error: 'No se pudo preparar el enlace.' }, { status: 503 })
    return NextResponse.json({ enlace: `https://t.me/${nombreBot(process.env.TELEGRAM_BOT_USERNAME)}?start=${token}` }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  if (b?.accion === 'confirmar' && typeof b.id === 'string' && /^[a-f0-9-]{36}$/i.test(b.id)) {
    const r = await db.rpc('clinica_confirmar_telegram', { p_usuario: a.usuario.id, p_vinculo: b.id })
    if (r.error || !r.data) return NextResponse.json({ error: r.error?.code === '23505' ? 'Este Telegram ya está vinculado a otra cuenta. Desvincúlalo primero.' : 'La solicitud venció o ya fue utilizada. Genera un enlace nuevo.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
}
