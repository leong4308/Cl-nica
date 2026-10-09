import { Bed, CalendarDays, ClipboardList, FileText, FlaskConical, LayoutDashboard, Settings, Stethoscope, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const navItems = [['Resumen', LayoutDashboard], ['Citas', CalendarDays], ['Pacientes', UsersRound], ['Médicos', Stethoscope], ['Expedientes', FileText], ['Internación', Bed], ['Órdenes médicas', ClipboardList], ['Laboratorio', FlaskConical]] as const

export const insigniasMenu: Record<string, string> = { Citas: '12', Internación: '8' }

export const itemsAdministracion: { label: string; icono: LucideIcon; soloAdmin?: boolean }[] = [
  { label: 'Usuarios', icono: UserRound, soloAdmin: true },
  { label: 'Configuración', icono: Settings, soloAdmin: true },
]
