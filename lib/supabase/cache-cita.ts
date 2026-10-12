import {
  cargarClinicaActiva,
  cargarDisponibilidad,
  cargarMedicosAgenda,
  cargarPacientesParaCita,
  filtrarDiasVigentes,
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
  if (!cache) return null
  return {
    ...cache,
    agendas: Object.fromEntries(
      Object.entries(cache.agendas).map(([id, ag]) => [
        Number(id),
        { ...ag, filas: filtrarDiasVigentes(ag.filas) },
      ]),
    ),
  }
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
  const guardada = cache?.agendas[medicoId]
  if (!guardada) return null
  return {
    ...guardada,
    filas: filtrarDiasVigentes(guardada.filas),
  }
}

export function actualizarAgendaEnCache(
  medicoId: number,
  filas: DiaDisponible[],
  error: string | null,
): void {
  if (!cache) return
  cache = { ...cache, agendas: { ...cache.agendas, [medicoId]: { filas, error } } }
}

export function ocuparSlotEnCache(medicoId: number, fecha: string, slot: string): void {
  if (!cache?.agendas[medicoId]) return
  const agenda = cache.agendas[medicoId]
  const nuevasFilas = agenda.filas
    .map((dia) => {
      if (dia.fecha !== fecha) return dia
      return {
        ...dia,
        slots: dia.slots.filter((s) => s !== slot),
      }
    })
    .filter((dia) => dia.slots.length > 0)

  cache.agendas[medicoId] = {
    ...agenda,
    filas: nuevasFilas,
  }
}

