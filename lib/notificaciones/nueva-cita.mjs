import { consultaTelegram } from './almacen.mjs'
import { llamarTelegram, textoTelegram } from './telegram.mjs'

const UUID = '[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}'
const html = v => String(v ?? '').slice(0, 150).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fecha = d => new Date(d.length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short' })
const hora = d => new Date(d).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const filas = (botones, n) => Array.from({ length: Math.ceil(botones.length / n) }, (_, i) => botones.slice(i * n, (i + 1) * n))
async function datos(db, op, params) { return (await consultaTelegram(db, op, params)).rows[0].r }

export async function procesarNuevaCita(db, tokenBot, update, fetcher = fetch) {
  const cb = update.callback_query, m = cb?.message ?? update.message
  const iniciar = /^\/agendar(?:@[a-zA-Z0-9_]+)?$/.test(update.message?.text ?? '')
  const medico = new RegExp(`^medico:(${UUID}):(\\d{1,12})$`).exec(cb?.data ?? '')
  const agenda = new RegExp(`^nuevo:(${UUID}):(\\d{4}-\\d{2}-\\d{2}):(\\d{1,2})$`).exec(cb?.data ?? '')
  const resumen = new RegExp(`^reservar:(${UUID})$`).exec(cb?.data ?? '')
  const confirmar = new RegExp(`^confirmar:(${UUID})$`).exec(cb?.data ?? '')
  if (!iniciar && !medico && !agenda && !resumen && !confirmar) return false
  if (m?.chat?.type !== 'private' || (cb?.from ?? m.from)?.id !== m.chat.id) return true
  if (cb) try { await llamarTelegram(tokenBot, 'answerCallbackQuery', { callback_query_id: cb.id }, fetcher) } catch (e) { if (e.codigo !== 400) throw e }
  const enviar = (text, botones) => llamarTelegram(tokenBot, 'sendMessage', { chat_id: m.chat.id, text, parse_mode: 'HTML', ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}) }, fetcher)
  try {
    if (iniciar) {
      const r = await datos(db, 'iniciarReserva', [m.chat.id]), publicados = r.medicos.filter(d => d.publicado)
      await enviar(`<b>🏥 Clínica Nova · Nueva cita</b>\n\n👤 ${html(r.paciente.nombre)}\n🩺 Elige a tu médico. Usaremos los datos de tu cuenta vinculada.${publicados.length ? '' : '\n\n📭 No hay horarios publicados. Contacta con recepción.'}`, publicados.length ? publicados.map(d => [{ text: `${d.nombre} · ${d.especialidad}`.slice(0, 100), callback_data: `medico:${r.token}:${d.id}` }]) : undefined)
    } else if (medico || agenda) {
      const r = await datos(db, 'horasReserva', medico ? [medico[1], m.chat.id, Number(medico[2]), null, 0] : [agenda[1], m.chat.id, null, agenda[2], Number(agenda[3])])
      if (!r.configurado || !r.dias?.length) { await enviar(html(r.motivo || 'No hay horarios libres en los próximos días. Revisa otras semanas en la aplicación o contacta con recepción.')); return true }
      const botones = filas(r.dias.map(d => ({ text: fecha(d), callback_data: `nuevo:${r.token}:${d}:0` })), 3)
      botones.push(...filas(r.opciones.map(t => ({ text: `${hora(t.inicio)} – ${hora(t.fin)}`, callback_data: `reservar:${t.token}` })), 2))
      const paginas = []
      if (r.pagina > 0) paginas.push({ text: '◀️ Horas anteriores', callback_data: `nuevo:${r.token}:${r.fecha}:${r.pagina - 1}` })
      if ((r.pagina + 1) * 6 < r.total) paginas.push({ text: 'Más horas ▶️', callback_data: `nuevo:${r.token}:${r.fecha}:${r.pagina + 1}` })
      if (paginas.length) botones.push(paginas)
      await enviar(`<b>🩺 ${html(r.medico)}</b>\n\n📅 <b>${fecha(r.fecha)}</b>\nHora de Ciudad de México\n\nSelecciona un horario para revisar tu cita antes de confirmarla.`, botones)
    } else if (resumen) {
      const r = await datos(db, 'resumenReserva', [resumen[1], m.chat.id])
      await enviar(`<b>📋 Clínica Nova · Revisa tu cita</b>\n\n📅 <b>${fecha(r.inicio)}</b>\n🕒 <b>${hora(r.inicio)} – ${hora(r.fin)} h</b>\n<i>Hora de Ciudad de México</i>\n\n👤 ${html(r.paciente)}\n🩺 ${html(r.medico)}\n📍 ${html(r.clinica)}${r.direccion ? '\n' + html(r.direccion) : ''}\n\nAl confirmar, se reservará el horario y se avisará al médico y a recepción. Podrás reagendar con más de 2 horas de anticipación.`, [[{ text: '✅ Confirmar y agendar', callback_data: `confirmar:${r.token}` }]])
    } else {
      const r = await datos(db, 'confirmarReserva', [confirmar[1], m.chat.id])
      await enviar(textoTelegram('Cita agendada y confirmada', '', r))
    }
  } catch (e) {
    await enviar('⚠️ ' + html(['42501', '40001', 'P0001', '23P01'].includes(e.code) ? e.message : 'No se pudo completar la reserva. Usa /agendar para consultar los horarios de nuevo.'))
  }
  return true
}
