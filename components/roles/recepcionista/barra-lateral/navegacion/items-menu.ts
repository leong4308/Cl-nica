import { Building2, ListOrdered, Mail, CalendarDays, LayoutDashboard, Stethoscope, UsersRound, Armchair, Inbox } from 'lucide-react'

export const navItemsRecepcion = [
  ['Resumen', LayoutDashboard],
  ['Citas', CalendarDays],
  ['Sala de espera', Armchair],
  ['Pacientes', UsersRound],
  ['Solicitudes', Inbox],
  ['Médicos', Stethoscope],
  ['Lista de espera', ListOrdered],
  ['Consultorios', Building2],
  ['Comunicaciones', Mail],
] as const

export type ItemMenuRecepcion = (typeof navItemsRecepcion)[number][0]
