import { consultaTelegram } from './almacen.mjs'
import { llamarTelegram, textoTelegram } from './telegram.mjs'

export function tecladoCita(token, confirmada = false, permiteReagendar = true) {
  return { inline_keyboard: [
    ...(!confirmada ? [[{ text: '✅ Sí asistiré', callback_data: `cita:c:${token}` }]] : []),
    ...(permiteReagendar ? [[{ text: '📅 Ver horarios libres', callback_data: `cita:r:${token}` }]] : []),
    [{ text: '🚫 Cancelar cita', callback_data: `cita:x:${token}` }],
  ] }
}

export async function botonesParaCita(db, usuario, cita) {
  if (!cita?.version || !['pendiente','confirmada'].includes(cita.estado)) return undefined
  const r = await consultaTelegram(db, 'crearAccion', [cita.id, usuario, cita.version, cita.estado])
  return r.rows[0] ? tecladoCita(r.rows[0].token, cita.estado === 'confirmada', Date.parse(cita.inicio) > Date.now()+2*60*60*1000) : undefined
}

const CADUCADO = 'Este mensaje ya no permite responder. Revisa la cita actual en Clínica Nova o utiliza un recordatorio más reciente.'
const codigoSeguro = e => ['42501','40001','P0001','23P01'].includes(e.code) ? e.message : 'No se pudo guardar tu respuesta. Inténtalo de nuevo.'

const hora = iso => new Date(iso).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
const fechaLegible = fecha => new Date(fecha.length===10?fecha+'T12:00:00Z':fecha).toLocaleDateString('es-MX',{timeZone:'America/Mexico_City',weekday:'long',day:'numeric',month:'long'})
export async function mostrarTurnos(db, tokenBot, accion, chat, fecha = null, pagina = 0, fetcher = fetch) {
  const datos=(await consultaTelegram(db,'turnosCita',[accion,chat,fecha,pagina])).rows[0].r
  if (!datos.permitido || !datos.configurado || !datos.dias?.length) {
    await llamarTelegram(tokenBot,'sendMessage',{chat_id:chat,text:datos.motivo||'No hay horarios libres esta semana. Consulta otras fechas desde la aplicación o contacta con recepción.'},fetcher)
    return
  }
  const filas=[],dias=datos.dias.map(d=>({text:new Date(d+'T12:00:00Z').toLocaleDateString('es-MX',{timeZone:'America/Mexico_City',weekday:'short',day:'numeric',month:'short'}),callback_data:`agenda:${accion}:${d}:0`}))
  for(let i=0;i<dias.length;i+=3) filas.push(dias.slice(i,i+3))
  const opciones=datos.opciones.map(o=>({text:`${hora(o.inicio)} – ${hora(o.fin)}`,callback_data:`turno:${o.token}`}))
  for(let i=0;i<opciones.length;i+=2) filas.push(opciones.slice(i,i+2))
  const paginas=[]
  if(datos.pagina>0) paginas.push({text:'Horas anteriores',callback_data:`agenda:${accion}:${datos.fecha}:${datos.pagina-1}`})
  if((datos.pagina+1)*6<datos.total) paginas.push({text:'Más horas',callback_data:`agenda:${accion}:${datos.fecha}:${datos.pagina+1}`})
  if(paginas.length) filas.push(paginas)
  await llamarTelegram(tokenBot,'sendMessage',{chat_id:chat,parse_mode:'HTML',text:`<b>📅 Cita #${datos.cita_id} · Horarios libres</b>\n\n📅 <b>${fechaLegible(datos.fecha)}</b>\nHora de Ciudad de México\n\nElige un día y toca un horario para reagendar y confirmar tu asistencia. Se avisará al médico y a recepción.\n\nLos turnos se verifican de nuevo al seleccionarlos. Solo puedes reagendar si faltan más de dos horas para tu cita actual.`,reply_markup:{inline_keyboard:filas}},fetcher)
}

async function accionVigente(db, token, chat) {
  const r = await consultaTelegram(db, 'leerAccion', [token, chat])
  return r.rows[0]
}

async function acusar(token, datos, fetcher) {
  try { await llamarTelegram(token, 'answerCallbackQuery', datos, fetcher) }
  catch (e) { if (e.codigo !== 400) throw e } // Un acuse caducado nunca bloquea el procesamiento de actualizaciones.
}

export async function procesarRespuestaCita(db, tokenBot, update, fetcher = fetch) {
  const cb = update.callback_query
  if (cb) {
    const turno=/^turno:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(cb.data??'')
    const agenda=/^agenda:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}):(\d{4}-\d{2}-\d{2}):(\d{1,2})$/.exec(cb.data??'')
    if ((turno||agenda) && cb.message?.chat?.type==='private' && cb.from?.id===cb.message.chat.id) {
      await acusar(tokenBot,{callback_query_id:cb.id},fetcher)
      try {
        if(agenda) await mostrarTurnos(db,tokenBot,agenda[1],cb.message.chat.id,agenda[2],Number(agenda[3]),fetcher)
        else {
          const r=(await consultaTelegram(db,'reagendarTurno',[turno[1],cb.message.chat.id])).rows[0].r
          await llamarTelegram(tokenBot,'sendMessage',{chat_id:cb.message.chat.id,text:`✅ ${r.mensaje}\n\n📅 ${fechaLegible(r.inicio)}\n🕒 ${hora(r.inicio)} – ${hora(r.fin)} h\nHora de Ciudad de México`},fetcher)
        }
      } catch(e) { await llamarTelegram(tokenBot,'sendMessage',{chat_id:cb.message.chat.id,text:codigoSeguro(e)},fetcher) }
      return true
    }
    const m = cb.message, match = /^cita:([crxd]):([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(cb.data ?? '')
    if (!match || m?.chat?.type !== 'private' || cb.from?.id !== m.chat.id) {
      await acusar(tokenBot, { callback_query_id: cb.id, text: 'Esta acción no está disponible para esta cuenta.', show_alert: true }, fetcher)
      return true
    }
    const a = await accionVigente(db, match[2], m.chat.id)
    if (!a) {
      await acusar(tokenBot, { callback_query_id: cb.id, text: CADUCADO, show_alert: true }, fetcher)
      return true
    }
    // Acusa el botón antes del trabajo para detener el indicador de Telegram.
    await acusar(tokenBot, { callback_query_id: cb.id }, fetcher)
    let texto
    if (match[1] === 'x') {
      await llamarTelegram(tokenBot, 'sendMessage', { chat_id: m.chat.id,
        text: `⚠️ ¿Confirmas que deseas cancelar la cita #${a.cita_id}? Se liberará el horario y se avisará al médico y a recepción.`,
        reply_markup: { inline_keyboard: [[{ text: '🚫 Sí, cancelar cita', callback_data: `cita:d:${a.token}` }]] } }, fetcher)
      return true
    }
    if (match[1] === 'r') {
      try { await mostrarTurnos(db,tokenBot,a.token,m.chat.id,null,0,fetcher) }
      catch(e) { await llamarTelegram(tokenBot,'sendMessage',{chat_id:m.chat.id,text:codigoSeguro(e)},fetcher) }
      return true
    } else {
      try { texto = (await consultaTelegram(db, 'responderSimple', [a.usuario_id, a.cita_id, a.version, match[1] === 'c' ? 'confirmar' : 'cancelar', 'telegram'])).rows[0].r.mensaje }
      catch (e) { texto = codigoSeguro(e) }
    }
    await llamarTelegram(tokenBot, 'sendMessage', { chat_id: m.chat.id, text: `ℹ️ ${texto}` }, fetcher)
    return true
  }
  const m = update.message
  if (m?.chat?.type !== 'private' || m.from?.id !== m.chat.id) return false
  if (/^\/citas(?:@[a-zA-Z0-9_]+)?$/.test(m.text ?? '')) {
    const r = await consultaTelegram(db, 'citasPropias', [m.chat.id])
    if (!r.rows.length) await llamarTelegram(tokenBot, 'sendMessage', { chat_id: m.chat.id, text: 'No hay citas próximas disponibles para este chat. Revisa tu portal y que Telegram siga vinculado desde Notificaciones.' }, fetcher)
    for (const fila of r.rows) await llamarTelegram(tokenBot, 'sendMessage', { chat_id: m.chat.id, text: textoTelegram('Tu próxima cita','',fila.cita), parse_mode: 'HTML', reply_markup: await botonesParaCita(db, fila.usuario_id, fila.cita) }, fetcher)
    return true
  }
  if (/^\/cancelar(?:@[a-zA-Z0-9_]+)?$/.test(m.text ?? '')) {
    await consultaTelegram(db, 'salirPregunta', [m.chat.id])
    await llamarTelegram(tokenBot, 'sendMessage', { chat_id: m.chat.id, text: 'Saliste de la solicitud. Tu cita no se canceló ni cambió.' }, fetcher)
    return true
  }
  if (!m.reply_to_message?.message_id) return false
  const pendiente = (await consultaTelegram(db, 'buscarPregunta', [m.chat.id, m.reply_to_message.message_id])).rows[0]
  if (!pendiente) {
    await llamarTelegram(tokenBot, 'sendMessage', { chat_id: m.chat.id, text: 'Esa solicitud ya terminó o venció. Usa /citas y pulsa «Solicitar otro horario» para enviar tus días y horas disponibles.' }, fetcher)
    return true
  }
  const a = await accionVigente(db, pendiente.token, m.chat.id)
  let texto = CADUCADO
  if (a) {
    if (typeof m.text !== 'string' || m.text.trim().length < 10 || m.text.length > 1000 || m.text.startsWith('/')) texto = 'Escribe entre 10 y 1000 caracteres con los días y horas en que puedes asistir, respondiendo al mismo mensaje. Para salir usa /cancelar.'
    else {
      try {
        texto = (await consultaTelegram(db, 'responderDisponibilidad', [a.usuario_id, a.cita_id, a.version, 'reagendar', m.text.trim(), 'telegram'])).rows[0].r.mensaje
        await consultaTelegram(db, 'cerrarPregunta', [a.token])
      } catch (e) { texto = codigoSeguro(e) }
    }
  }
  await llamarTelegram(tokenBot, 'sendMessage', { chat_id: m.chat.id, text: texto }, fetcher)
  return true
}
