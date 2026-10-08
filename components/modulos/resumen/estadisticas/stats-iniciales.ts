import { Activity, Bed, CalendarDays, UsersRound } from 'lucide-react'

/**
 * Tarjetas del dashboard con sus valores de arranque.
 *
 * Viven junto a `estadisticas.tsx`, el único que las usa: eran de
 * `compartidos/data.ts`, que mezclaba datos de módulos, del dashboard y de los
 * botones rápidos en un solo archivo.
 *
 * Los valores en '0' / 'Cargando' son el marcador previo; en cuanto responda
 * Supabase, `estadisticas.tsx` los reemplaza por las cifras reales.
 */
export const dashboardStats = [
  { icon: CalendarDays, label: 'Citas de hoy', value: '0', meta: 'Cargando', tone: 'blue' },
  { icon: UsersRound, label: 'Pacientes activos', value: '0', meta: 'Cargando', tone: 'violet' },
  { icon: Bed, label: 'Camas ocupadas', value: '0', meta: 'Cargando', tone: 'orange' },
  { icon: Activity, label: 'Órdenes pendientes', value: '00', meta: 'Cargando', tone: 'green' },
]
