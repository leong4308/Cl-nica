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

/** Módulos del menú lateral, en el mismo orden que `cargarModulo`. */
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
let enCurso: Promise<void> | null = null

/** Lecturas síncronas: los componentes las usan en el render para pintar de una. */
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

/**
 * Guarda lo que un componente acaba de leer de Supabase, para que la próxima
 * visita sea inmediata. Los errores no se guardan: así un fallo puntual de red
 * no queda congelado en la caché.
 */
export function guardarModulo(nombre: string, filas: ResultadoModulo['filas'], error: string | null): void {
  if (error) return
  modulos[nombre] = { filas, error: null }
}

export function guardarPanel(filas: CitaPanel[], error: string | null): void {
  if (error) return
  panel = { filas, error: null }
}

/**
 * Precarga los siete módulos y los paneles del resumen. Se dispara al entrar a
 * la app, no al navegar: cambiar de pestaña queda instantáneo y el resumen
 * aparece completo desde el primer render.
 */
export function precargarModulos(): Promise<void> {
  if (enCurso) return enCurso

  // El `.catch` va dentro: la precarga es una optimización, así que si Supabase
  // falla la promesa resuelve igual y cada componente usa su carga normal.
  const trabajo = (async () => {
    const [resultadosModulos, panelRes, estadisticasRes, medicosRes, camasRes] = await Promise.all([
      Promise.all(NOMBRES_MODULOS.map(async (nombre) => [nombre, await cargarModulo(nombre)] as const)),
      cargarCitasPanel(),
      cargarResumenEstadisticas(),
      cargarMedicosTurno(),
      cargarResumenCamas(),
    ])

    for (const [nombre, resultado] of resultadosModulos) {
      if (!resultado.error) modulos[nombre] = resultado
    }
    if (!panelRes.error) panel = panelRes
    if (!estadisticasRes.error) estadisticas = estadisticasRes.filas
    if (!medicosRes.error) medicosTurno = medicosRes.filas
    if (!camasRes.error) camas = camasRes.filas
  })().catch(() => undefined)

  enCurso = trabajo
  void trabajo.finally(() => {
    if (enCurso === trabajo) enCurso = null
  })
  return trabajo
}
