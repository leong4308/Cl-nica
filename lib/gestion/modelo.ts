export type ModuloGestion = 'envios' | 'espera' | 'consultorios' | 'controles' | 'reportes'
export const ROLES_GESTION: Record<ModuloGestion, string[]> = { envios: ['admin', 'recepcionista'], espera: ['admin', 'recepcionista', 'paciente'], consultorios: ['admin', 'recepcionista'], controles: ['medico', 'paciente'], reportes: ['admin'] }
export const TITULOS_GESTION: Record<ModuloGestion, string> = { envios: 'Comunicaciones', espera: 'Lista de espera', consultorios: 'Consultorios', controles: 'Controles de seguimiento', reportes: 'Reportes administrativos' }
const CAMPOS: Record<string, string[]> = {
  'consultorios:sala': ['clinicaId', 'nombre', 'ubicacion'], 'consultorios:editar_sala': ['id', 'version', 'nombre', 'ubicacion', 'activo'],
  'consultorios:turno': ['consultorioId', 'medicoId', 'desde', 'hasta', 'dia', 'inicio', 'fin'], 'consultorios:baja_turno': ['id', 'version'],
  'espera:inscribir': ['pacienteId', 'medicoId', 'citaId', 'desde', 'hasta', 'inicio', 'fin'], 'espera:retirar': ['id', 'version'], 'espera:ofertar': ['id', 'version', 'inicio'], 'espera:aceptar': ['ofertaId'], 'espera:rechazar': ['ofertaId'],
  'controles:crear': ['pacienteId', 'citaId', 'fecha', 'titulo', 'indicaciones', 'diasAviso'], 'controles:completar': ['id', 'version', 'nota'], 'controles:cancelar': ['id', 'version', 'nota'], 'controles:vincular_cita': ['id', 'version', 'citaId'], 'envios:reintentar': ['id', 'canal'],
}
export const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
export function fechaValida(v: unknown): v is string { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v }
export function datosGestion(modulo: ModuloGestion, accion: string, valor: unknown, rol: string): Record<string, unknown> {
  if (!ROLES_GESTION[modulo]?.includes(rol)) throw Error('Sin acceso al módulo.')
  const campos = CAMPOS[`${modulo}:${accion}`]
  if (!campos || !valor || typeof valor !== 'object' || Array.isArray(valor)) throw Error('Acción o datos inválidos.')
  if ((modulo === 'consultorios' && rol !== 'admin') || (modulo === 'controles' && (rol === 'paciente' ? accion !== 'vincular_cita' : accion === 'vincular_cita')) || (modulo === 'espera' && (rol === 'paciente' ? accion === 'ofertar' : ['aceptar', 'rechazar'].includes(accion)))) throw Error('Esta acción no corresponde a tu rol.')
  const entrada = valor as Record<string, unknown>, datos = Object.fromEntries(campos.filter(k => entrada[k] !== undefined).map(k => [k, entrada[k]]))
  for (const [k, v] of Object.entries(datos)) {
    if (['id', 'pacienteId', 'medicoId', 'consultorioId', 'clinicaId', 'citaId'].includes(k) && !(k === 'citaId' && (v === null || v === '')) && (!Number.isSafeInteger(v) || Number(v) < 1)) throw Error('Selecciona un registro válido.')
    if (['desde', 'hasta', 'fecha'].includes(k) && !fechaValida(v)) throw Error('Fecha inválida.')
    if (k === 'version' && (typeof v !== 'string' || !/^[a-f0-9]{32}$/.test(v))) throw Error('Actualiza los datos antes de guardar.')
    if (k === 'ofertaId' && (typeof v !== 'string' || !UUID.test(v))) throw Error('Oferta inválida.')
    if (k === 'diasAviso' && (!Number.isInteger(v) || Number(v) < 0 || Number(v) > 30)) throw Error('El aviso debe ser de 0 a 30 días antes.')
    if (k === 'dia' && (!Number.isInteger(v) || Number(v) < 0 || Number(v) > 6)) throw Error('Selecciona un día válido.')
    if (['nombre', 'ubicacion', 'titulo', 'indicaciones', 'nota'].includes(k) && (typeof v !== 'string' || v.length > (({ nombre: 80, ubicacion: 200, titulo: 120, indicaciones: 1000, nota: 1000 } as Record<string, number>)[k] ?? 1000))) throw Error('Revisa la extensión de los textos.')
  }
  const opcionales = ['ubicacion', 'indicaciones', 'citaId', ...(rol === 'paciente' ? ['pacienteId'] : [])]
  if (campos.some(k => !opcionales.includes(k) && (datos[k] === undefined || datos[k] === null || datos[k] === ''))) throw Error('Completa los campos obligatorios.')
  if (datos.activo !== undefined && typeof datos.activo !== 'boolean') throw Error('Estado inválido.')
  if (datos.canal !== undefined && !['correo', 'telegram'].includes(String(datos.canal))) throw Error('Canal inválido.')
  for (const k of ['inicio', 'fin']) if (datos[k] !== undefined) {
    const v = String(datos[k]); if (modulo === 'espera' && accion === 'ofertar' ? !Number.isFinite(Date.parse(v)) : !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v)) throw Error('Horario inválido.')
  }
  return datos
}
export async function consultarGestion<T>(modulo: ModuloGestion, parametros = '', signal?: AbortSignal): Promise<T> {
  const r = await fetch(`/api/gestion/${modulo}${parametros ? '?' + parametros : ''}`, { cache: 'no-store', signal }), b = await r.json()
  if (!r.ok) throw Error(b.error || 'No se pudo consultar el módulo.')
  return b
}
export async function guardarGestion(modulo: ModuloGestion, accion: string, datos: Record<string, unknown>, clave: string) {
  const r = await fetch(`/api/gestion/${modulo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, datos, clave }) }), b = await r.json()
  if (!r.ok) throw Error(b.error || 'No se pudo guardar.')
  window.dispatchEvent(new Event('datos-actualizados')); return b as { id?: number; mensaje: string }
}
