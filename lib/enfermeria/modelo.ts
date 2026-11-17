export type PacienteEnfermeria = { id: number; nombre: string; telefono: string | null; contacto: string | null; telefono_emergencia: string | null; alertas: string | null }
export type TareaEnfermeria = { id: number; paciente_id: number; tipo: 'medicamento' | 'control' | 'cuidado'; titulo: string; datos: Record<string, string>; programada: string; estado: string; vigente: boolean }
export type RegistroEnfermeria = { id: number; paciente_id: number; tipo: string; datos: { texto?: string; valores?: Record<string, number>; titulo?: string; estado?: string; etapa?: string; solicitudId?: number; citaId?: number; operacion?: string; [key: string]: unknown }; autor: number; responsable: string; creado_en: string; observado_en: string; corrige_id: number | null; destinatario: number | null; respuesta: string | null; confirmado_en: string | null; recibido_por: string | null }
export type PanelEnfermeriaDatos = {
  rol: string; usuarioId: number; enfermeroId: number | null; servidorAhora: string; pacientes: PacienteEnfermeria[]
  enfermeros: { id: number; nombre: string; clinica_id: number }[]
  turnos: { id: number; paciente_id: number; enfermero_id: number; enfermero: string; inicio: string; fin: string; area: string }[]
  tareas: TareaEnfermeria[]; registros: RegistroEnfermeria[]
  citas: { id: number; paciente_id: number; inicio: string; fin: string; estado: string; motivo: string | null; medico: string }[]
  ingresos: { id: number; paciente_id: number; estado: string; version: string; clinica_id: number; cama: string; habitacion: string; medico: string }[]
  ordenes: { id: number; paciente_id: number; tipo_orden: string; descripcion: string; instrucciones: string | null; estado: string; version: string }[]
  muestras: { id: number; paciente_id: number; estudio: string; estado_analisis: string; fecha_toma_muestra: string | null; fecha_entrega_muestra?: string | null; resultado?: string | null; con_documento?: boolean }[]
  movimientos: { id: number; paciente_id: number; tipo: string; cama_id: number | null; version: string; indicacion: string; medico: string }[]
  resumenCamas?: { total: number; ocupadas: number; libres: number; fueraServicio?: number }
  mapaCamas?: { id: number; numero: string; habitacion: string; tipo: string; clinica_id: number; esta_ocupada: boolean; habilitada: boolean; habitacion_activa: boolean; ocupante?: { id: number; pacienteId: number; paciente: string; medicoId: number; medico: string; fechaIngreso: string; asignado: boolean } | null }[]
  camas: { id: number; clinica_id: number; habitacion: string; cama: string }[]
}
export type FormularioEnfermeria = { accion: string; titulo: string; pacienteId: number; inicial?: Record<string, unknown> }
export const SIGNOS_ENFERMERIA = [
  { id: 'sistolica', nombre: 'Presión sistólica', unidad: 'mmHg' }, { id: 'diastolica', nombre: 'Presión diastólica', unidad: 'mmHg' },
  { id: 'pulso', nombre: 'Frecuencia cardiaca', unidad: 'lpm' }, { id: 'temperatura', nombre: 'Temperatura', unidad: '°C' },
  { id: 'saturacion', nombre: 'Saturación de oxígeno', unidad: '%' }, { id: 'peso', nombre: 'Peso', unidad: 'kg' }, { id: 'glucosa', nombre: 'Glucosa', unidad: 'mg/dL' },
]
export const fechaEnfermeria = (v: string) => new Date(v).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
