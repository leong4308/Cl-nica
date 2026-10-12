import { Bed, Calendar, ClipboardList, FlaskConical, LayoutDashboard, UsersRound } from 'lucide-react'

export const navItemsEnfermero = [
  ['Resumen', LayoutDashboard],
  ['Pacientes', UsersRound],
  ['Citas', Calendar],
  ['Internación', Bed],
  ['Órdenes médicas', ClipboardList],
  ['Laboratorio', FlaskConical],
] as const

export type ItemMenuEnfermero = (typeof navItemsEnfermero)[number][0]
