import type { CitaPanel } from '@/lib/supabase/datos'

/** Fila de una tabla de módulo, en el orden de las columnas de `config`. */
export type Row = string[]

/**
 * Contrato que `app/page.tsx` le pasa a cada módulo: avisos, apertura de
 * modales, navegación y las acciones sobre una cita concreta.
 *
 * Vive en `compartidos/` porque lo consumen `citas/`, `resumen/` y el resto de
 * módulos. La configuración de las tablas (`ModuleConfig`) no: esa se fue a
 * `citas/configuracion-modulos.ts`, que es donde de verdad se usa.
 */
export type ClinicActions = {
  notify: (message: string) => void
  openModal: (title: string) => void
  navigate: (label: string) => void
  addAppointment: (appointment: Row) => void
  /** Abre el modal de acciones (detalle / reagendar) sobre una cita concreta. */
  onAccion: (cita: CitaPanel, accion: 'detalle' | 'reagendar') => void
}

