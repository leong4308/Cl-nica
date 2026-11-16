import { sumarDias } from '@/lib/agenda/modelo'

export type TurnoConsultorio = {
  id: number; consultorioId: number; medicoId: number; medico: string
  desde: string; hasta: string; dia: number; inicio: string; fin: string; activo: boolean; version: string
}
export type FranjaConsultorio = Pick<TurnoConsultorio, 'medicoId' | 'medico' | 'dia' | 'inicio' | 'fin' | 'desde' | 'hasta'>

// Una renovación contigua conserva el horario semanal; un hueco entre fechas se mantiene separado.
export function agruparFranjasConsultorio(turnos: TurnoConsultorio[]): FranjaConsultorio[] {
  const grupos = new Map<string, FranjaConsultorio[]>()
  for (const t of [...turnos].filter(t => t.activo).sort((a, b) => a.desde.localeCompare(b.desde) || a.hasta.localeCompare(b.hasta))) {
    const clave = JSON.stringify([t.consultorioId, t.medicoId, t.dia, t.inicio, t.fin])
    const periodos = grupos.get(clave) ?? [], anterior = periodos.at(-1)
    if (anterior && t.desde <= sumarDias(anterior.hasta, 1)) anterior.hasta = [anterior.hasta, t.hasta].sort().at(-1)!
    else periodos.push({ medicoId: t.medicoId, medico: t.medico, dia: t.dia, inicio: t.inicio, fin: t.fin, desde: t.desde, hasta: t.hasta })
    grupos.set(clave, periodos)
  }
  return [...grupos.values()].flat()
}

export function franjasEnFecha(franjas: FranjaConsultorio[], medicoId: number, fecha: string) {
  return franjas.filter(t => t.medicoId === medicoId && t.desde <= fecha && t.hasta >= fecha)
    .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio))
}
