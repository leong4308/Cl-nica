import { Building2, Inbox, ListOrdered, ChartNoAxesCombined, Bed, CalendarDays, ClipboardList, FileText, FlaskConical, LayoutDashboard, Settings, Stethoscope, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

/**
 * Permisos por rol:
 * - admin: Ve todo (dashboard global, todos los módulos, gestión de usuarios)
 * - recepcionista: Resumen, Citas, Pacientes, Médicos (solo directorio)
 * - medico: Citas, Pacientes y Expedientes; Mi Consulta queda en administración
 * - enfermero: Resumen, Citas, Pacientes, Internación, Órdenes médicas
 * - paciente: Solo su perfil (no aplica menú lateral)
 */

type NavItem = {
  label: string
  icon: LucideIcon
  roles: RolUsuario[]        // qué roles pueden ver este item
  medicoLabel?: string       // etiqueta alternativa para médicos
}

export const navItems: NavItem[] = [
  { label: 'Enfermería', icon: ClipboardList, roles: ['admin'] },
  {
    label: 'Resumen',
    icon: LayoutDashboard,
    roles: ['admin', 'recepcionista', 'enfermero'],
  },
  {
    label: 'Mi Consulta',
    icon: Stethoscope,
    roles: ['admin'],
  },
  {
    label: 'Citas',
    icon: CalendarDays,
    roles: ['admin', 'recepcionista', 'medico', 'enfermero'],
  },
  {
    label: 'Pacientes',
    icon: UsersRound,
    roles: ['admin', 'recepcionista', 'medico', 'enfermero'],
  },
  {
    label: 'Médicos',
    icon: Stethoscope,
    roles: ['admin', 'recepcionista'],
  },
  {
    label: 'Expedientes',
    icon: FileText,
    roles: ['admin', 'medico'],
  },
  {
    label: 'Internación',
    icon: Bed,
    roles: ['admin', 'medico', 'enfermero'],
  },
  {
    label: 'Órdenes médicas',
    icon: ClipboardList,
    roles: ['admin', 'medico', 'enfermero'],
  },
  {
    label: 'Laboratorio',
    icon: FlaskConical,
    roles: ['admin', 'medico', 'enfermero'],
  },
  { label: 'Comunicaciones', icon: Inbox, roles: ['admin', 'recepcionista'] },
  { label: 'Lista de espera', icon: ListOrdered, roles: ['admin', 'recepcionista'] },
  { label: 'Consultorios', icon: Building2, roles: ['admin', 'recepcionista'] },
  { label: 'Reportes', icon: ChartNoAxesCombined, roles: ['admin'] },
  { label: 'Controles', icon: CalendarDays, roles: ['medico'] },
]

export function obtenerNavItemsPorRol(rol: RolUsuario): NavItem[] {
  return navItems.filter((item) => item.roles.includes(rol))
}

export function obtenerItemDefaultPorRol(rol: RolUsuario): string {
  if (rol === 'medico') return 'Citas'
  return 'Resumen'
}

export const insigniasMenu: Record<string, string> = { Citas: '0', Internación: '0' }

export const itemsAdministracion: { label: string; icono: LucideIcon; soloAdmin?: boolean }[] = [
  { label: 'Usuarios', icono: UserRound, soloAdmin: true },
  { label: 'Historial de cambios', icono: ClipboardList, soloAdmin: true },
  { label: 'Configuración', icono: Settings, soloAdmin: true },
]
