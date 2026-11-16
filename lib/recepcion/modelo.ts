import { fechaClinica, instanteClinica, type BloqueAgenda, type DescansoAgenda } from '@/lib/agenda/modelo'
export type CitaRecepcion = { consultorio?: string | null; id: number; pacienteId: number; paciente: string; telefono: string | null; medicoId: number; medico: string; inicio: string; fin: string; estado: string; motivo: string | null; llegada: string | null; enConsulta: string | null; version: string }
export type MedicoRecepcion = { id: number; nombre: string; especialidad: string; bloques: BloqueAgenda[]; descansos: DescansoAgenda[] }
export type PanelRecepcion = { dia: string; ahora: string; citas: CitaRecepcion[]; medicos: MedicoRecepcion[] }
export const activa = (c: CitaRecepcion) => ['pendiente', 'confirmada'].includes(c.estado)
export function etapaCita(c: CitaRecepcion) {
  if (c.estado === 'atendida') return 'Finalizada'
  if (c.estado.startsWith('cancelada')) return 'Cancelada'
  if (c.estado === 'no_asistio') return 'No asistió'
  return c.enConsulta ? 'En consulta' : c.llegada ? 'En espera' : c.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'
}
export function esperaMinutos(c: CitaRecepcion, ahora: number) { return c.llegada ? Math.max(0, Math.floor(((c.enConsulta ? Date.parse(c.enConsulta) : ahora) - Date.parse(c.llegada)) / 60000)) : null }
export function puedeReagendar(c: CitaRecepcion, ahora: number) { return activa(c) && !c.llegada && Date.parse(c.inicio) - ahora > 2 * 3600000 }
export function estadoMedico(m: MedicoRecepcion, dia: string, ahora: number) {
  if (!m.bloques?.length) return 'Horario no publicado'
  const bloques = m.bloques.filter(b => b.dia === new Date(dia + 'T12:00:00Z').getUTCDay())
  if (!bloques.length) return 'Día de descanso'
  if (dia !== fechaClinica(new Date(ahora))) return 'Jornada publicada'
  if (m.descansos?.some(d => d.fecha === dia && ahora >= Date.parse(instanteClinica(dia, d.inicio)) && ahora < Date.parse(instanteClinica(dia, d.fin)))) return 'En descanso'
  return bloques.some(b => ahora >= Date.parse(instanteClinica(dia, b.inicio)) && ahora < Date.parse(instanteClinica(dia, b.fin))) ? 'En horario de consulta' : 'Fuera de horario'
}
export function indicadores(citas: CitaRecepcion[]) {
  return { total: citas.length, pendientes: citas.filter(c => activa(c) && !c.enConsulta).length, espera: citas.filter(c => activa(c) && c.llegada && !c.enConsulta).length, consulta: citas.filter(c => activa(c) && c.enConsulta).length, finalizadas: citas.filter(c => c.estado === 'atendida').length, canceladas: citas.filter(c => c.estado.startsWith('cancelada')).length }
}
