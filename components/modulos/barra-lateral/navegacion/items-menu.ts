import { Bed, CalendarDays, ClipboardList, FileText, FlaskConical, LayoutDashboard, Settings, Stethoscope, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

/**
 * Permisos por rol:
 * - admin: Ve todo (dashboard global, todos los módulos, gestión de usuarios)
 * - recepcionista: Resumen, Citas, Pacientes, Médicos (solo directorio), Expedientes
 * - medico: Mi Consulta (su estación), Citas (solo las suyas), Pacientes (solo los suyos), Expedientes
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
  {
    label: 'Resumen',
    icon: LayoutDashboard,
    roles: ['admin', 'recepcionista', 'enfermero'],
  },
  {
    label: 'Mi Consulta',
    icon: Stethoscope,
    roles: ['medico'],
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
    roles: ['admin', 'recepcionista', 'medico'],
  },
  {
    label: 'Internación',
    icon: Bed,
    roles: ['admin', 'enfermero'],
  },
  {
    label: 'Órdenes médicas',
    icon: ClipboardList,
    roles: ['admin', 'medico', 'enfermero'],
  },
  {
    label: 'Laboratorio',
    icon: FlaskConical,
    roles: ['admin'],
  },
]

export function obtenerNavItemsPorRol(rol: RolUsuario): NavItem[] {
  return navItems.filter((item) => item.roles.includes(rol))
}

export function obtenerItemDefaultPorRol(rol: RolUsuario): string {
  if (rol === 'medico') return 'Mi Consulta'
  return 'Resumen'
}

export const insigniasMenu: Record<string, string> = { Citas: '0', Internación: '0' }

export const itemsAdministracion: { label: string; icono: LucideIcon; soloAdmin?: boolean }[] = [
  { label: 'Usuarios', icono: UserRound, soloAdmin: true },
  { label: 'Configuración', icono: Settings, soloAdmin: true },
]
