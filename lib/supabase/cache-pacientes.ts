import {
  cargarHistorialPaciente,
  cargarPerfilPaciente,
  type HistorialPaciente,
  type PerfilPacienteDetalle,
} from './datos'

const cachePerfiles = new Map<number, PerfilPacienteDetalle>()
const cacheHistoriales = new Map<number, HistorialPaciente[]>()
const enCurso = new Map<number, Promise<void>>()

/** Registra un perfil de paciente directamente en memoria */
export function registrarPerfilPacienteEnCache(perfil: PerfilPacienteDetalle): void {
  cachePerfiles.set(perfil.id, perfil)
}

/** Obtiene el perfil del paciente si ya está disponible en caché */
export function leerPerfilPacienteEnCache(pacienteId: number): PerfilPacienteDetalle | null {
  return cachePerfiles.get(pacienteId) ?? null
}

/** Registra el historial de un paciente */
export function registrarHistorialPacienteEnCache(pacienteId: number, historial: HistorialPaciente[]): void {
  cacheHistoriales.set(pacienteId, historial)
}

/** Lee el historial clínico si ya está disponible en caché */
export function leerHistorialPacienteEnCache(pacienteId: number): HistorialPaciente[] | null {
  return cacheHistoriales.get(pacienteId) ?? null
}

/** Retorna instantáneamente (0ms) los datos iniciales disponibles en memoria */
export function obtenerDatosPacienteInicial(pacienteId: number): {
  perfil: PerfilPacienteDetalle | null
  historial: HistorialPaciente[] | null
} {
  return {
    perfil: cachePerfiles.get(pacienteId) ?? null,
    historial: cacheHistoriales.get(pacienteId) ?? null,
  }
}

/** Pre-carga en background el perfil y el historial clínico del paciente */
export function precargarPerfilPaciente(pacienteId: number): Promise<void> {
  if (cachePerfiles.has(pacienteId) && cacheHistoriales.has(pacienteId)) {
    return Promise.resolve()
  }
  if (enCurso.has(pacienteId)) {
    return enCurso.get(pacienteId)!
  }

  const promesa = (async () => {
    const tareas: Promise<unknown>[] = []
    if (!cachePerfiles.has(pacienteId)) {
      tareas.push(
        cargarPerfilPaciente(pacienteId).then(({ perfil }) => {
          if (perfil) cachePerfiles.set(pacienteId, perfil)
        })
      )
    }
    if (!cacheHistoriales.has(pacienteId)) {
      tareas.push(
        cargarHistorialPaciente(pacienteId).then(({ filas }) => {
          if (filas) cacheHistoriales.set(pacienteId, filas)
        })
      )
    }
    await Promise.all(tareas)
  })().catch(() => undefined).finally(() => {
    enCurso.delete(pacienteId)
  })

  enCurso.set(pacienteId, promesa)
  return promesa
}
