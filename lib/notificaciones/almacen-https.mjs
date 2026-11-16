import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export function almacenHTTPS(url, clave) {
  if (!url || !clave) throw Error('Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.')
  const cliente = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, opciones) => fetch(url, { ...opciones, signal: AbortSignal.timeout(30_000) }) } })
  const reserva = randomUUID()
  async function rpc(nombre, argumentos) {
    const r = await cliente.rpc(nombre, argumentos)
    if (r.error) { const e = Error(({ '42501':'Esta acción no está disponible para tu cuenta. Verifica la vinculación en la aplicación.', '40001':'La información cambió. Consulta nuevamente tus citas.', 'P0001':'No se pudo completar esta acción. Consulta la aplicación o contacta con recepción.', '23P01':'El horario ya no está disponible. Elige otro turno.' })[r.error.code] ?? 'SUPABASE_HTTPS'); e.code = r.error.code ?? 'HTTPS'; throw e }
    return r.data
  }
  return {
    correo: (operacion, datos = {}) => rpc('clinica_correo_operar', { p_reserva: reserva, p_operacion: operacion, p_datos: datos }),
    version: () => rpc('clinica_version', {}),
    reservar: () => rpc('clinica_reservar_trabajador', { p_reserva: reserva }),
    liberar: () => rpc('clinica_reservar_trabajador', { p_reserva: reserva, p_liberar: true }),
    operar: async (operacion, parametros = []) => ({ rows: await rpc('clinica_operar_telegram', { p_reserva: reserva, p_operacion: operacion, p_datos: parametros }) }),
  }
}
