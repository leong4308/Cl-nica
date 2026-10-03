import {
  cargarClinicaActiva,
  cargarDisponibilidad,
  cargarMedicosAgenda,
  cargarPacientesParaCita,
  type DiaDisponible,
  type MedicoAgenda,
} from './datos'

/** Datos que el modal "Nueva cita" necesita para abrirse completo al instante. */
export type CacheCita = {
  medicos: MedicoAgenda[]
  pacientes: { id: number; nombre: string }[]
  clinicaId: number | null
  agendas: Record<number, { filas: DiaDisponible[]; error: string | null }>
}

let cache: CacheCita | null = null
let enCurso: Promise<void> | null = null

/** Lectura síncrona: el modal la usa durante el render, sin esperar nada. */
export function leerCacheCita(): CacheCita | null {
  return cache
}

/**
 * Precarga médicos, pacientes, clínica y la agenda de cada médico.
 * Se dispara al entrar a la app, no al abrir el modal: por eso "Nueva cita"
 * abre completo a la primera, sin estados intermedios ni parpadeo.
 */
export function precargarCita(): Promise<void> {
  if (enCurso) return enCurso

  // El `.catch` va dentro: la precarga es una optimización, así que si Supabase
  // falla la promesa resuelve igual y el modal usa su propia carga normal.
  const trabajo = (async () => {
    const [medicosResult, pacientesResult, clinicaId] = await Promise.all([
      cargarMedicosAgenda(),
      cargarPacientesParaCita(),
      cargarClinicaActiva(),
    ])

    // La agenda de cada médico se pide en paralelo: así cambiar de médico en el
    // selector también es instantáneo.
    const agendas = await Promise.all(
      medicosResult.filas.map(
        async (medico) =>
          [medico.id, await cargarDisponibilidad(medico.id, medico.duracionConsulta)] as const,
      ),
    )

    // Solo se publica cuando todo llegó bien, para no dejar el modal a medias.
    cache = {
      medicos: medicosResult.filas,
      pacientes: pacientesResult.filas,
      clinicaId,
      agendas: Object.fromEntries(agendas),
    }
  })().catch(() => undefined)

  enCurso = trabajo
  void trabajo.finally(() => {
    if (enCurso === trabajo) enCurso = null
  })
  return trabajo
}

/**
 * Agenda ya calculada de un médico, si está en caché. La usa también el modal
 * de "Reagendar", que así abre con las fechas disponibles de inmediato.
 */
export function leerAgendaEnCache(
  medicoId: number,
): { filas: DiaDisponible[]; error: string | null } | null {
  return cache?.agendas[medicoId] ?? null
}

/**
 * Guarda en caché la agenda recién calculada de un médico. Se usa tras crear
 * una cita para que al reabrir el modal ese horario ya figure como ocupado.
 */
export function actualizarAgendaEnCache(
  medicoId: number,
  filas: DiaDisponible[],
  error: string | null,
): void {
  if (!cache) return
  cache = { ...cache, agendas: { ...cache.agendas, [medicoId]: { filas, error } } }
}
