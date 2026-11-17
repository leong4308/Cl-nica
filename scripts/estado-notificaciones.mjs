import { createClient } from '@supabase/supabase-js'
import { entorno } from './entorno-operacion.mjs'
import { configuracionCorreo } from '../lib/notificaciones/correo.mjs'
import { llamarTelegram, nombreBot } from '../lib/notificaciones/telegram.mjs'

// Solo consultas: no reserva trabajos, consume mensajes ni envía avisos.
const env = entorno(), config = configuracionCorreo(env)
try {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error('CONFIGURACION_SUPABASE')
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, op) => fetch(url, { ...op, signal: AbortSignal.timeout(20_000) }) } })
  const comprobar = r => { if (r.error) throw Error('SUPABASE_' + (r.error.code ?? 'HTTPS')); return r }
  const reserva = comprobar(await db.from('telegram_trabajador').select('vence_en').eq('id', 1).single()).data
  const resultado = { trabajadorActivo: Date.parse(reserva.vence_en) > Date.now(), correoConfigurado: Boolean(config), remitenteDePrueba: /@resend\.dev\b/i.test(config?.remitente ?? ''), telegramConfigurado: Boolean(env.TELEGRAM_BOT_TOKEN), colas: {} }
  for (const canal of ['telegram', 'correo']) {
    resultado.colas[canal] = {}
    for (const estado of ['pendiente', 'enviando', 'enviado', 'omitido', 'fallido']) resultado.colas[canal][estado] = comprobar(await db.from(canal + '_envios').select('id', { count: 'exact', head: true }).eq('estado', estado)).count
  }
  if (env.TELEGRAM_BOT_TOKEN) {
    const [bot, webhook] = await Promise.all([llamarTelegram(env.TELEGRAM_BOT_TOKEN, 'getMe', {}), llamarTelegram(env.TELEGRAM_BOT_TOKEN, 'getWebhookInfo', {})])
    resultado.bot = { nombreCoincide: nombreBot(env.TELEGRAM_BOT_USERNAME)?.toLowerCase() === bot.username?.toLowerCase(), webhookConfigurado: Boolean(webhook.url) }
  }
  console.log(JSON.stringify(resultado, null, 2))
} catch (e) { console.error('No se pudo comprobar el estado. Código: ' + (e.code ?? e.message)); process.exitCode = 1 }
