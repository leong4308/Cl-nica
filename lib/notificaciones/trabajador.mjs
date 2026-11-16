import { procesarNuevaCita } from './nueva-cita.mjs'
import { consultaTelegram } from './almacen.mjs'
import { llamarTelegram, solicitudVinculo, textoTelegram } from './telegram.mjs'
import { botonesParaCita, procesarRespuestaCita } from './respuestas-citas.mjs'

export async function procesarOfertaEspera(db, token, update, fetcher = fetch) {
  const c = update.callback_query, accion = /^espera:([ar]):([a-f0-9-]{36})$/i.exec(c?.data ?? '')
  if (!accion) return false
  if (c.message?.chat?.type !== 'private' || c.from?.id !== c.message.chat.id) return true
  let texto
  try {
    const r = await consultaTelegram(db, 'respuestaEspera', [c.message.chat.id, accion[2], accion[1] === 'a' ? 'aceptar' : 'rechazar'])
    texto = r.rows[0]?.r?.mensaje ?? 'Respuesta guardada. Consulta tu lista de espera en la aplicación.'
  } catch (e) {
    // Un corte de red debe reintentarse; un rechazo de negocio se acusa sin publicar detalles internos.
    if (!['42501', '40001', '23P01', '23505', 'P0001', '22023'].includes(e.code)) throw e
    texto = 'Esta oferta ya no está disponible o tu cita no permite el cambio. Tus citas se conservan. Revisa Lista de espera en la aplicación.'
  }
  try { await llamarTelegram(token, 'answerCallbackQuery', { callback_query_id: c.id, text: 'Respuesta procesada' }, fetcher) } catch { /* El acuse puede vencer; la operación es idempotente. */ }
  try { await llamarTelegram(token, 'sendMessage', { chat_id: c.message.chat.id, text: texto }, fetcher) } catch { /* La respuesta permanece en el portal. */ }
  return true
}

export async function procesarActualizaciones(db, token, updates, fetcher = fetch) {
  for (const update of updates) {
    if (!Number.isSafeInteger(update.update_id)) continue
    const previo = (await consultaTelegram(db, 'control')).rows[0]
    if (Number(previo.ultimo_update) >= update.update_id) continue
    if (await procesarOfertaEspera(db, token, update, fetcher) || await procesarNuevaCita(db, token, update, fetcher) || await procesarRespuestaCita(db, token, update, fetcher)) {
      await consultaTelegram(db, 'avanzarControl', [update.update_id])
      continue
    }
    const solicitud = solicitudVinculo(update)
    const mensaje = update.message
    let respuesta
    if (solicitud) {
      const r = await consultaTelegram(db, 'recibirVinculo', [solicitud.chat, solicitud.nombre, solicitud.hash])
      respuesta = r.rows.length ? '✅ Solicitud recibida. Vuelve a Notificaciones en Clínica Nova y confirma esta cuenta de Telegram. Hasta entonces no recibirás datos de citas.' : '🔗 El enlace venció o ya fue utilizado. Genera otro desde Notificaciones en Clínica Nova.'
    } else if (mensaje?.chat?.type === 'private' && mensaje.from?.id === mensaje.chat.id) {
      if (/^\/stop(?:@[a-zA-Z0-9_]+)?$/.test(mensaje.text ?? '')) {
        await consultaTelegram(db, 'desactivarChat', [mensaje.chat.id])
        await consultaTelegram(db, 'vencerVinculos', [mensaje.chat.id])
        respuesta = '🔕 Se desactivaron los avisos de Telegram. Puedes volver a vincular tu cuenta desde Clínica Nova.'
      } else if (/^\/start(?:@[a-zA-Z0-9_]+)?$/.test(mensaje.text ?? '')) {
        respuesta = '🏥 Para recibir recordatorios, inicia sesión en Clínica Nova, abre Notificaciones y pulsa Vincular Telegram. Tu número de teléfono por sí solo no activa los mensajes. Si ya vinculaste tu cuenta de paciente, usa /agendar para una nueva cita o /citas para consultar tus próximas visitas.'
      }
    }
    await consultaTelegram(db, 'avanzarControl', [update.update_id])
    if (respuesta) {
      try { await llamarTelegram(token, 'sendMessage', { chat_id: mensaje.chat.id, text: respuesta }, fetcher) } catch { /* La vinculación queda disponible en el portal aunque no llegue el acuse. */ }
    }
  }
}

export async function entregarPendientes(db, token, fetcher = fetch) {
  const envios = (await consultaTelegram(db, 'reclamar')).rows
  let enviados = 0
  for (const envio of envios) {
    // Revisa de nuevo consentimiento, reserva y vigencia inmediatamente antes de enviar.
    const vigente = await consultaTelegram(db, 'envioVigente', [envio.envio_id, envio.reserva, envio.chat_id])
    if (!vigente.rows.length) {
      await consultaTelegram(db, 'omitir', [envio.envio_id, envio.reserva])
      continue
    }
    try {
      const actual = vigente.rows[0]
      const botones = actual.ofertaId ? { inline_keyboard: [[{ text: '✅ Aceptar horario', callback_data: `espera:a:${actual.ofertaId}` }, { text: 'Otro momento', callback_data: `espera:r:${actual.ofertaId}` }]] } : actual.tipo === 'solicitud_cambio' ? undefined : await botonesParaCita(db, actual.usuario_id, actual.cita)
      await llamarTelegram(token, 'sendMessage', { chat_id: envio.chat_id, text: textoTelegram(envio.titulo, envio.mensaje, actual.tipo === 'solicitud_cambio' ? null : actual.cita), parse_mode: 'HTML', reply_markup: botones, link_preview_options: { is_disabled: true } }, fetcher)
      await consultaTelegram(db, 'marcarEnviado', [envio.envio_id, envio.reserva])
      enviados++
    } catch (e) {
      if (e.codigo === 403) await consultaTelegram(db, 'desactivarChat', [envio.chat_id])
      await consultaTelegram(db, 'errorEnvio', [envio.envio_id, envio.reserva, String(e.codigo ?? 'RED'), e.reintentarEn ?? 60])
    }
  }
  return enviados
}
