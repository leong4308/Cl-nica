import {
  cargarClinicaActiva,
  cargarDisponibilidad,
  cargarMedicosAgenda,
  cargarPacientesParaCita,
  type DiaDisponible,
  type MedicoAgenda,
} from './datos'

export type CacheCita = {
  medicos: MedicoAgenda[]
  pacientes: { id: number; nombre: string }[]
  clinicaId: number | null
  agendas: Record<number, { filas: DiaDisponible[]; error: string | null }>
}

let cache: CacheCita | null = null
let enCurso: Promise<void> | null = null

export function leerCacheCita(): CacheCita | null {
  return cache
}

export function precargarCita(): Promise<void> {
  if (enCurso) return enCurso

  const trabajo = (async () => {
    const [medicosResult, pacientesResult, clinicaId] = await Promise.all([
      cargarMedicosAgenda(),
      cargarPacientesParaCita(),
      cargarClinicaActiva(),
    ])

    const agendas = await Promise.all(
      medicosResult.filas.map(
        async (medico) =>
          [medico.id, await cargarDisponibilidad(medico.id, medico.duracionConsulta)] as const,
      ),
    )

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

export function leerAgendaEnCache(
  medicoId: number,
): { filas: DiaDisponible[]; error: string | null } | null {
  return cache?.agendas[medicoId] ?? null
}

export function actualizarAgendaEnCache(
  medicoId: number,
  filas: DiaDisponible[],
  error: string | null,
): void {
  if (!cache) return
  cache = { ...cache, agendas: { ...cache.agendas, [medicoId]: { filas, error } } }
}
