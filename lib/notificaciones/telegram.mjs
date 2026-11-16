import { createHash } from 'node:crypto'

export const hashVinculo = token => createHash('sha256').update(token).digest('hex')
export function nombreBot(valor) {
  const nombre = (valor ?? '').replace(/^@/, '')
  return /^[a-zA-Z0-9_]{2,29}bot$/i.test(nombre) ? nombre : null
}
export async function llamarTelegram(token, metodo, datos, fetcher = fetch) {
  if (!token) throw Error('TELEGRAM_NO_CONFIGURADO')
  let respuesta
  try {
    respuesta = await fetcher(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos), signal: AbortSignal.timeout(25_000),
    })
  } catch { throw Error('TELEGRAM_RED') }
  const body = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok || !body.ok) {
    const e = Error('TELEGRAM_' + (body.error_code ?? respuesta.status))
    e.codigo = body.error_code ?? respuesta.status
    e.reintentarEn = Math.min(3600, Math.max(30, Number(body.parameters?.retry_after) || 60))
    throw e
  }
  return body.result
}

function html(valor, maximo = 100) {
  return Array.from(String(valor ?? '')).slice(0, maximo).join('').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function textoTelegram(titulo, mensaje, cita = null) {
  const encabezado = `<b>🏥 Clínica Nova</b>\n<i>${html(titulo, 80)}</i>`
  const pie = 'Consulta los detalles en tu cuenta.\n🔕 Desactivar avisos: /stop'
  if (!cita?.id) return `${encabezado}\n\n${html(mensaje, 1800)}\n\n${pie}`
  const inicio = new Date(cita.inicio), fin = new Date(cita.fin)
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime())) return textoTelegram(titulo, mensaje)
  const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(inicio)
  const formatoHora = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const estados = { pendiente: '⏳ Pendiente de confirmación', confirmada: '✅ Confirmada', atendida: '✅ Consulta atendida', no_asistio: '⚠️ Inasistencia registrada', cancelada_paciente: '🚫 Cancelada por el paciente', cancelada_medico: '🚫 Cancelada por el médico' }
  const fechaLegible = fecha.charAt(0).toLocaleUpperCase('es-MX') + fecha.slice(1)
  return `${encabezado}\n\n📅 <b>${html(fechaLegible, 100)}</b>\n🕒 <b>${formatoHora.format(inicio)} – ${formatoHora.format(fin)} h</b>\n<i>Hora de Ciudad de México</i>\n\n👤 Paciente: ${html(cita.paciente)}\n🩺 Médico: ${html(cita.medico)}\n\n📍 ${html(cita.clinica, 120)}${cita.direccion ? '\n' + html(cita.direccion, 180) : ''}${cita.consultorio ? '\n🚪 ' + html(cita.consultorio, 200) : ''}\n\n<blockquote>${estados[cita.estado] ?? html(cita.estado, 40)} · Cita #${html(cita.id, 20)}</blockquote>\n\n${pie}`
}

// Solo chats privados; un grupo nunca puede convertirse en destinatario clínico.
export function solicitudVinculo(update) {
  const m = update?.message
  if (m?.chat?.type !== 'private' || m.from?.id !== m.chat?.id) return null
  const match = /^\/start(?:@[a-zA-Z0-9_]+)? ([a-zA-Z0-9_-]{43})$/.exec(m.text ?? '')
  if (!match) return null
  return { hash: hashVinculo(match[1]), chat: m.chat.id, nombre: (m.from.first_name ?? m.from.username ?? 'Cuenta de Telegram').slice(0, 100) }
}
