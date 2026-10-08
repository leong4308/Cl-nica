import { Bed, CalendarDays, ClipboardList, FileText, FlaskConical, LayoutDashboard, Settings, Stethoscope, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Botones de la barra lateral: navegación + administración.
 *
 * Vive en `barra-lateral/navegacion/` porque es donde se pintan los botones
 * (`barra-lateral.tsx`): la lista no es "compartida", solo la consume la barra.
 */
export const navItems = [['Resumen', LayoutDashboard], ['Citas', CalendarDays], ['Pacientes', UsersRound], ['Médicos', Stethoscope], ['Expedientes', FileText], ['Internación', Bed], ['Órdenes médicas', ClipboardList], ['Laboratorio', FlaskConical]] as const

export const insigniasMenu: Record<string, string> = { Citas: '12', Internación: '8' }

export const itemsAdministracion: { label: string; icono: LucideIcon; soloAdmin?: boolean }[] = [
  { label: 'Usuarios', icono: UserRound, soloAdmin: true },
  { label: 'Configuración', icono: Settings, soloAdmin: true },
]
