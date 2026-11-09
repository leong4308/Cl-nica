import type { FichaImportante, SignosVitales } from '@/lib/supabase/datos'

export type SeccionFichaClinica = 'alertas' | 'signos' | 'completa'
export const CAMPOS_ALERTAS = ['alergias', 'tipoSangre', 'condicionesCronicas', 'medicamentoActual'] as const
export const CAMPOS_SIGNOS = ['presionArterial', 'frecuenciaCardiaca', 'temperatura', 'saturacionOxigeno', 'peso', 'glucosa'] as const

export function leerFichaClinica(raw: string | null | undefined): FichaImportante {
  if (!raw?.trim()) return {}
  try {
    const ficha = JSON.parse(raw)
    return ficha && typeof ficha === 'object' && !Array.isArray(ficha) ? ficha : {}
  } catch { return { condicionesCronicas: raw } }
}

export function actualizarFichaClinica(raw: string | null, cambios: unknown, seccion: SeccionFichaClinica, registrador: string, ahora: string): FichaImportante {
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) throw Error('La información de la ficha no es válida.')
  const entrada = cambios as Record<string, unknown>
  const ficha = { ...leerFichaClinica(raw) }
  if (seccion === 'alertas' || seccion === 'completa') {
    for (const campo of CAMPOS_ALERTAS) {
      if (!(campo in entrada)) continue
      const valor = entrada[campo]
      if (valor !== undefined && valor !== null && typeof valor !== 'string') throw Error('Revisa los campos de alertas y antecedentes.')
      if (typeof valor === 'string' && valor.length > (campo === 'tipoSangre' ? 30 : 4000)) throw Error('La información de las alertas supera el tamaño permitido.')
      ficha[campo] = typeof valor === 'string' && valor.trim() ? valor.trim() : undefined
    }
  }
  if (seccion === 'signos' || seccion === 'completa') {
    const signos = entrada.signosVitales ?? {}
    if (typeof signos !== 'object' || Array.isArray(signos)) throw Error('Los signos vitales no son válidos.')
    const anteriores = ficha.signosVitales
    const nuevos: SignosVitales = { ...anteriores }
    for (const campo of CAMPOS_SIGNOS) {
      if (!(campo in signos)) continue
      const valor = (signos as Record<string, unknown>)[campo]
      if (valor !== undefined && valor !== null && (typeof valor !== 'string' || valor.length > 40)) throw Error('Revisa los valores de los signos vitales.')
      nuevos[campo] = typeof valor === 'string' && valor.trim() ? valor.trim() : undefined
    }
    const hayValores = CAMPOS_SIGNOS.some((campo) => nuevos[campo])
    const cambiaron = CAMPOS_SIGNOS.some((campo) => (anteriores?.[campo] ?? '') !== (nuevos[campo] ?? ''))
    ficha.signosVitales = hayValores ? (cambiaron ? { ...nuevos, tomadoPor: registrador, fechaHora: ahora } : anteriores) : undefined
  }
  return ficha
}
