export type EstadoInternacion = 'activa' | 'alta' | 'traslado'
export type CamaHospital = { id: number; habitacionId: number; clinicaId: number; numero: string; habitacion: string; tipo: string; ocupada: boolean; paciente: string | null; internacionId: number | null; inconsistente: boolean }
export type MedicoHospital = { id: number; nombre: string; especialidad: string; clinicaId: number }
export type PacienteHospital = { id: number; nombre: string; ingresoActivo: boolean }
export type IngresoHospital = { id: number; pacienteId: number; paciente: string; medicoId: number; medico: string; clinicaId: number; habitacionId: number; habitacion: string; tipoHabitacion: string; camaId: number; cama: string; ingreso: string; alta: string | null; estado: EstadoInternacion; motivo: string; diagnostico: string; version: string }
export type MovimientoHospital = { id: number; fecha: string; tipo: string; descripcion: string; autor: string }
export type DatosHospital = { ingresos: IngresoHospital[]; camas: CamaHospital[]; medicos: MedicoHospital[]; pacientes: PacienteHospital[] }

export function limpiarHabitacion(valor: string): string { return valor.replace(/^(?:habitaci[oó]n\s+|hab\.?\s+)/i, '').trim() }
export function limpiarCama(valor: string): string { return valor.replace(/^cama\s*/i, '').trim() }
export function ubicacionHospital(habitacion: string, cama: string): string { return `Habitación ${limpiarHabitacion(habitacion) || '—'} · Cama ${limpiarCama(cama) || '—'}` }
export const ESTADOS_HOSPITAL: Record<EstadoInternacion, string> = { activa: 'Hospitalizado', alta: 'Alta', traslado: 'Traslado externo' }
export function fechaHospital(valor: string | null, conHora = false): string {
  if (!valor || Number.isNaN(Date.parse(valor))) return 'Sin registrar'
  return new Date(valor).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric', ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}) })
}
export function diasHospital(ingreso: string, alta: string | null): number { return Math.max(1, Math.ceil(((alta ? Date.parse(alta) : Date.now()) - Date.parse(ingreso)) / 86400000) || 1) }

export async function consultarHospital<T>(ruta = '', opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`/api/internacion${ruta}`, { cache: 'no-store', ...opciones })
  const datos = await respuesta.json()
  if (!respuesta.ok) throw Error(datos.error || 'No se pudo completar la operación de internación.')
  return datos as T
}
export function guardarHospital<T>(ruta: string, cuerpo: unknown, metodo = 'POST'): Promise<T> { return consultarHospital<T>(ruta, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }) }
