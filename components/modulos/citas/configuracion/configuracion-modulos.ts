import { CalendarDays, ClipboardList, FileText, FlaskConical, Stethoscope, UsersRound, Bed } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ModuleConfig = {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  action: string
  columns: string[]
  rows: string[][]
}

export const modules: Record<string, Omit<ModuleConfig, 'rows'>> = {
  Citas: { icon: CalendarDays, eyebrow: 'Gestión de agenda', title: 'Citas médicas', description: 'Programa, confirma y da seguimiento a las consultas.', action: 'Nueva cita', columns: ['Hora', 'Paciente', 'Médico', 'Motivo', 'Estado'] },
  Pacientes: { icon: UsersRound, eyebrow: 'Directorio clínico', title: 'Pacientes', description: 'Administra datos e historial de tus pacientes.', action: 'Nuevo paciente', columns: ['Paciente', 'Identificación', 'Teléfono', 'Nacimiento', 'Estado'] },
  Médicos: { icon: Stethoscope, eyebrow: 'Personal médico', title: 'Médicos y especialistas', description: 'Consulta especialidades, horarios y disponibilidad.', action: 'Registrar médico', columns: ['Profesional', 'Especialidad', 'Registro', 'Duración', 'Estado'] },
  Expedientes: { icon: FileText, eyebrow: 'Historia clínica', title: 'Expedientes médicos', description: 'Registra consultas, diagnósticos, recetas y documentos.', action: 'Nuevo expediente', columns: ['Paciente', 'Motivo', 'Diagnóstico', 'Médico', 'Actualizado'] },
  Internación: { icon: Bed, eyebrow: 'Hospitalización', title: 'Internación y camas', description: 'Controla habitaciones, admisiones, traslados y altas.', action: 'Nueva admisión', columns: ['Habitación', 'Paciente', 'Ingreso', 'Médico', 'Estado'] },
  'Órdenes médicas': { icon: ClipboardList, eyebrow: 'Indicaciones clínicas', title: 'Órdenes médicas', description: 'Revisa estudios, tratamientos y solicitudes pendientes.', action: 'Nueva orden', columns: ['Orden', 'Episodio', 'Médico', 'Descripción', 'Estado'] },
  Laboratorio: { icon: FlaskConical, eyebrow: 'Resultados clínicos', title: 'Laboratorio', description: 'Gestiona solicitudes y entrega resultados de análisis.', action: 'Registrar resultado', columns: ['Muestra', 'Orden', 'Estudio', 'Solicitado', 'Estado'] },
}
