import type { CitaPanel } from '@/lib/supabase/datos'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

export type Row = string[]

export type ClinicActions = {
  notify: (message: string) => void
  openModal: (title: string) => void
  navigate: (label: string) => void
  addAppointment: (appointment: Row) => void
  onAccion: (cita: CitaPanel, accion: 'detalle' | 'reagendar' | 'historial') => void
  rol?: RolUsuario
}
