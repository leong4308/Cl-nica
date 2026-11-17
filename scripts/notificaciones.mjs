import { setTimeout } from 'node:timers/promises'
import { entorno } from './entorno-operacion.mjs'
import { almacenHTTPS } from '../lib/notificaciones/almacen-https.mjs'
import { consultaTelegram } from '../lib/notificaciones/almacen.mjs'
import { llamarTelegram, nombreBot } from '../lib/notificaciones/telegram.mjs'
import { procesarActualizaciones, entregarPendientes } from '../lib/notificaciones/trabajador.mjs'

import { configuracionCorreo, entregarCorreos } from '../lib/notificaciones/correo.mjs'

const env = entorno(), correo = configuracionCorreo(env)
const unaVez = process.argv.includes('--una-vez')
let activo = true, db, reservado = false
process.on('SIGINT', () => { activo = false })
process.on('SIGTERM', () => { activo = false })
process.on('message', m => { if (m?.tipo === 'detener-notificaciones') activo = false })
try {
  db = almacenHTTPS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const version = await db.version()
  if (correo && version < 33) throw Error('Instala la migración 033_portal_y_correo.sql para habilitar los correos.')
  if (version < 27) throw Error('Instala la migración 027_autogestion_y_sesiones.sql antes de iniciar este trabajador.')
  reservado = await db.reservar()
  if (!reservado) throw Object.assign(Error('Ya hay un trabajador activo. Si terminó inesperadamente, su reserva vence en cinco minutos.'), { code: 'TRABAJADOR_EXISTENTE' })
  if (!env.TELEGRAM_BOT_TOKEN && !correo && !unaVez) throw Error('Configura Telegram o el servicio de correo en .env.local.')
  if (env.TELEGRAM_BOT_TOKEN) {
    const bot = await llamarTelegram(env.TELEGRAM_BOT_TOKEN, 'getMe', {})
    if (nombreBot(env.TELEGRAM_BOT_USERNAME)?.toLowerCase() !== bot.username?.toLowerCase()) throw Error('TELEGRAM_BOT_USERNAME no corresponde al token configurado.')
    const webhook = await llamarTelegram(env.TELEGRAM_BOT_TOKEN, 'getWebhookInfo', {})
    if (webhook.url) throw Error('Este bot ya utiliza un webhook. Usa un bot dedicado a Clínica Nova; no se modificó su configuración.')
  }
  console.log('Trabajador de notificaciones iniciado por HTTPS. No se muestran tokens ni datos de citas.')
  do {
    try {
      if (!await db.reservar()) { activo = false; throw Object.assign(Error('RESERVA_OCUPADA'), { code: 'RESERVA_OCUPADA' }) }
      const r = await consultaTelegram(db, 'recordatorios')
      const correos = await entregarCorreos(db, correo)
      if (correos) console.log(JSON.stringify({ correosAceptados: correos }))
      if (env.TELEGRAM_BOT_TOKEN) {
        const control = (await consultaTelegram(db, 'control')).rows[0]
        const updates = await llamarTelegram(env.TELEGRAM_BOT_TOKEN, 'getUpdates', { offset: Number(control.ultimo_update) + 1, timeout: unaVez ? 0 : 15, allowed_updates: ['message', 'callback_query'], limit: 50 })
        await procesarActualizaciones(db, env.TELEGRAM_BOT_TOKEN, updates)
        const enviados = await entregarPendientes(db, env.TELEGRAM_BOT_TOKEN)
        if (r.rows[0].generados || enviados) console.log(JSON.stringify({ recordatorios: r.rows[0].generados, telegramEnviados: enviados }))
      } else if (!unaVez) await setTimeout(15000)
    } catch (e) {
      console.error('No se completó un ciclo. Código: ' + (e.code ?? (/^TELEGRAM_/.test(e.message) ? e.message : 'OPERACION')))
      if (unaVez || !activo) process.exitCode = 1
      else await setTimeout(10_000)
    }
  } while (activo && !unaVez)
} catch (e) {
  if (e.code === 'TRABAJADOR_EXISTENTE') {
    process.send?.({ tipo: 'trabajador-existente' })
    if (!process.send) console.log('Los avisos ya están atendidos por otro trabajador activo; no se iniciará uno duplicado.')
  } else {
    console.error(e.code ? 'No se pudo iniciar. Código: ' + e.code : e.message)
    process.exitCode = 1
  }
} finally {
  if (reservado) try { await db.liberar() } catch { /* La reserva vence sin intervención si no hay conexión. */ }
  if (process.connected) process.disconnect()
}
