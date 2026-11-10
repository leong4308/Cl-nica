import type { DiagnosticoCie10, MedicamentoPrescrito, SignosVitales } from '@/components/modulos/medicos/types'

type Expediente = { diagnostico?: string | null; receta?: string | null; notas_doctor?: string | null }
export type NotaConsulta = { subjetivo: string; objetivo: string; plan: string; diagnosticos: DiagnosticoCie10[] }

// Conserva también los expedientes antiguos que solo contienen texto libre.
export function leerConsulta(expediente?: Expediente | null): { soap: NotaConsulta; prescripciones: MedicamentoPrescrito[] } {
  const notas = expediente?.notas_doctor ?? ''
  const esSoap = notas.startsWith('--- FORMATO S.O.A.P. ---')
  const seccion = (inicio: string, fin?: string) => {
    const posicion = notas.indexOf(inicio)
    if (posicion < 0) return ''
    const texto = notas.slice(posicion + inicio.length)
    const corte = fin ? texto.indexOf(fin) : -1
    return (corte >= 0 ? texto.slice(0, corte) : texto).trim()
  }
  const diagnostico = expediente?.diagnostico?.trim() ?? ''
  const lineas = diagnostico.split('\n').map((linea) => linea.match(/^\[([^\]]+)\] (.*) \((Principal|Secundario)\)$/))
  const diagnosticos: DiagnosticoCie10[] = !diagnostico ? [] : lineas.every((p) => p !== null)
    ? lineas.map((p) => ({ codigo: p![1], descripcion: p![2], tipo: p![3] as DiagnosticoCie10['tipo'] }))
    : [{ codigo: '', descripcion: diagnostico, tipo: 'Principal' }]
  const receta = expediente?.receta?.trim() ?? ''
  const prescripciones: MedicamentoPrescrito[] = receta ? receta.split(/\n(?=\d+\. )/).map((texto, i) => {
    const partes = texto.match(/^\d+\. ([\s\S]*?) \[(Nuevo|Continuación)\] - ([\s\S]*?) \(([^()]*)\)$/)
    return partes
      ? { id: `registrada-${i}`, nombre: partes[1], tipo: partes[2] as MedicamentoPrescrito['tipo'], posologia: partes[3], presentacion: partes[4] }
      : { id: `registrada-${i}`, nombre: texto, tipo: 'Continuación', posologia: '', presentacion: '', textoOriginal: texto }
  }) : []
  return {
    soap: {
      subjetivo: esSoap ? seccion('S (Subjetivo):', 'O (Objetivo):') : notas,
      objetivo: esSoap ? seccion('O (Objetivo):', 'Signos Vitales:') : '',
      plan: esSoap ? seccion('P (Plan Médico):') : '',
      diagnosticos,
    },
    prescripciones,
  }
}

export function escribirConsulta(soap: Omit<NotaConsulta, 'diagnosticos'>, diagnosticos: DiagnosticoCie10[], prescripciones: MedicamentoPrescrito[], signos?: SignosVitales) {
  const diagnostico = diagnosticos.map((d) => d.codigo ? `[${d.codigo}] ${d.descripcion} (${d.tipo})` : d.descripcion).join('\n')
  const receta = prescripciones.map((p, i) => p.textoOriginal ?? `${i + 1}. ${p.nombre} [${p.tipo}] - ${p.posologia} (${p.presentacion})`).join('\n')
  const notas_doctor = `--- FORMATO S.O.A.P. ---
S (Subjetivo):
${soap.subjetivo}

O (Objetivo):
${soap.objetivo}
Signos Vitales: TA: ${signos?.presionArterial ?? 'N/D'} | FC: ${signos?.frecuenciaCardiaca ?? 'N/D'} lpm | SpO2: ${signos?.spo2 ?? 'N/D'}% | Temp: ${signos?.temperatura ?? 'N/D'}°C | Peso: ${signos?.peso ?? 'N/D'}kg

A (Análisis):
${diagnostico}

P (Plan Médico):
${soap.plan}
`
  return { diagnostico, receta, notas_doctor }
}
