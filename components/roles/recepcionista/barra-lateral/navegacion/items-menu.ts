import { CalendarDays, LayoutDashboard, Stethoscope, UsersRound } from 'lucide-react'

export const navItemsRecepcion = [
  ['Resumen', LayoutDashboard],
  ['Citas', CalendarDays],
  ['Pacientes', UsersRound],
  ['Médicos', Stethoscope],
] as const

export type ItemMenuRecepcion = (typeof navItemsRecepcion)[number][0]
