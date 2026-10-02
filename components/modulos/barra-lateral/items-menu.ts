import { Bed, CalendarDays, ClipboardList, FileText, FlaskConical, LayoutDashboard, Settings, Stethoscope, UserRound, UsersRound } from 'lucide-react'

export const navItems = [['Resumen', LayoutDashboard], ['Citas', CalendarDays], ['Pacientes', UsersRound], ['Médicos', Stethoscope], ['Expedientes', FileText], ['Internación', Bed], ['Órdenes médicas', ClipboardList], ['Laboratorio', FlaskConical]] as const

export const insigniasMenu: Record<string, string> = { Citas: '12', Internación: '8' }

export const itemsAdministracion = [
  { label: 'Usuarios', icono: UserRound },
  { label: 'Configuración', icono: Settings },
] as const