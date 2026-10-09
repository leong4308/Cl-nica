import {
  cargarCitasPanel,
  cargarMedicosTurno,
  cargarModulo,
  cargarResumenCamas,
  cargarResumenEstadisticas,
  type CitaPanel,
  type EstadisticasResumen,
  type MedicoTurno,
  type ResumenCamas,
} from './datos'

const NOMBRES_MODULOS = [
  'Citas',
  'Pacientes',
  'Médicos',
  'Expedientes',
  'Internación',
  'Órdenes médicas',
  'Laboratorio',
] as const

type ResultadoModulo = Awaited<ReturnType<typeof cargarModulo>>
type ResultadoPanel = Awaited<ReturnType<typeof cargarCitasPanel>>

let modulos: Record<string, ResultadoModulo> = {}
let panel: ResultadoPanel | null = null
let estadisticas: EstadisticasResumen | null = null
let medicosTurno: MedicoTurno[] | null = null
let camas: ResumenCamas | null = null
let contadorGeneracion = 0

export function leerModulo(nombre: string): ResultadoModulo | null {
  return modulos[nombre] ?? null
}
export function leerPanel(): ResultadoPanel | null {
  return panel
}
export function leerEstadisticas(): EstadisticasResumen | null {
  return estadisticas
}
export function leerMedicosTurno(): MedicoTurno[] | null {
  return medicosTurno
}
export function leerCamas(): ResumenCamas | null {
  return camas
}

export function guardarModulo(nombre: string, filas: ResultadoModulo['filas'], error: string | null): void {
  if (error) return
  modulos[nombre] = { filas, error: null }
}

export function guardarPanel(filas: CitaPanel[], error: string | null): void {
  if (error) return
  panel = { filas, error: null }
}

export function precargarModulos(): Promise<void> {
  const generacion = ++contadorGeneracion

  return (async () => {
    const [resultadosModulos, panelRes, estadisticasRes, medicosRes, camasRes] = await Promise.all([
      Promise.all(NOMBRES_MODULOS.map(async (nombre) => [nombre, await cargarModulo(nombre)] as const)),
      cargarCitasPanel(),
      cargarResumenEstadisticas(),
      cargarMedicosTurno(),
      cargarResumenCamas(),
    ])

    if (generacion !== contadorGeneracion) return

    for (const [nombre, resultado] of resultadosModulos) {
      if (!resultado.error) modulos[nombre] = resultado
    }
    if (!panelRes.error) panel = panelRes
    if (!estadisticasRes.error) estadisticas = estadisticasRes.filas
    if (!medicosRes.error) medicosTurno = medicosRes.filas
    if (!camasRes.error) camas = camasRes.filas
  })().catch(() => undefined)
}
