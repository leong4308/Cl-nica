import type { ContenidoConsulta } from './modelo'

export const PREFIJO_BORRADOR_CONSULTA = 'cn:consulta:'
const CAMPOS = ['subjetivo', 'objetivo', 'diagnostico', 'plan', 'pronostico', 'seguimiento', 'recetaLibre'] as const
const MEDICAMENTO = ['nombre', 'dosis', 'via', 'frecuencia', 'duracion'] as const
export type BorradorConsulta = { version: string; contenido: ContenidoConsulta; actualizado: number }

export function claveBorradorConsulta(editorId: string, citaId: number) {
  return `${PREFIJO_BORRADOR_CONSULTA}${editorId}:${citaId}`
}
export function firmaContenidoConsulta(contenido: ContenidoConsulta) {
  return JSON.stringify({ ...Object.fromEntries(CAMPOS.map(k => [k, contenido[k] ?? ''])), medicamentos: contenido.medicamentos.map(m => Object.fromEntries(MEDICAMENTO.map(k => [k, m[k] ?? '']))) })
}
export function medicamentosCompletos(contenido: ContenidoConsulta) {
  return contenido.medicamentos.length <= 30 && contenido.medicamentos.every(m => MEDICAMENTO.every(k => typeof m[k] === 'string' && m[k].trim().length > 0 && m[k].trim().length <= (k === 'via' ? 120 : 200)))
}
export function leerBorradorConsulta(clave: string, storage: Pick<Storage, 'getItem' | 'removeItem'>, ahora = Date.now()): BorradorConsulta | null {
  try {
    const texto = storage.getItem(clave)
    if (!texto) return null
    if (texto.length > 128000) throw Error('Tamaño inválido')
    const b = JSON.parse(texto), c = b?.contenido
    if (!/^[a-f0-9]{32}$/.test(b?.version ?? '') || !Number.isFinite(b.actualizado) || b.actualizado > ahora + 60000 || ahora - b.actualizado > 24 * 3600000 || !c || CAMPOS.some(k => typeof c[k] !== 'string' || c[k].length > 8000) || !Array.isArray(c.medicamentos) || c.medicamentos.length > 30 || c.medicamentos.some((m: unknown) => !m || typeof m !== 'object' || MEDICAMENTO.some(k => typeof (m as Record<string, unknown>)[k] !== 'string' || ((m as Record<string, string>)[k]).length > 200))) throw Error('Borrador inválido')
    return { version: b.version, actualizado: b.actualizado, contenido: JSON.parse(firmaContenidoConsulta(c)) }
  } catch { try { storage.removeItem(clave) } catch {} return null }
}
export function protegerBorradorConsulta(clave: string | null, version: string, contenido: ContenidoConsulta): boolean {
  if (!clave || typeof window === 'undefined') return false
  try { window.sessionStorage.setItem(clave, JSON.stringify({ version, contenido: JSON.parse(firmaContenidoConsulta(contenido)), actualizado: Date.now() })); return true } catch { return false }
}
export function retirarBorradorConsulta(clave: string | null) {
  if (!clave || typeof window === 'undefined') return
  try { window.sessionStorage.removeItem(clave) } catch {}
}
