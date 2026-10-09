import { Activity, Bed, CalendarDays, UsersRound } from 'lucide-react'

export const dashboardStats = [
  { icon: CalendarDays, label: 'Citas de hoy', value: '0', meta: 'Cargando', tone: 'blue' },
  { icon: UsersRound, label: 'Pacientes activos', value: '0', meta: 'Cargando', tone: 'violet' },
  { icon: Bed, label: 'Camas ocupadas', value: '0', meta: 'Cargando', tone: 'orange' },
  { icon: Activity, label: 'Órdenes pendientes', value: '00', meta: 'Cargando', tone: 'green' },
]
