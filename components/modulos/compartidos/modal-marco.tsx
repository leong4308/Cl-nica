'use client'

import { type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Marco común de los modales de la clínica: fondo semitransparente, recuadro
 * blanco, cabecera con título y ✕ de cerrar, y ranuras para el contenido,
 * el pie (Cancelar / Guardar) y el aviso.
 *
 * Vive en `compartidos/` porque lo comparten modales de carpetas distintas:
 * `buscar-paciente/`, `nueva-cita/` y el de Usuarios, que se abre desde la
 * barra lateral y no desde las acciones rápidas del dashboard.
 *
 * Si un modal no recibe `footer` ni `aviso`, no se dibujan: así "Buscar
 * paciente" queda sin botones de pie, igual que antes.
 */

/** Clases del campo de formulario, compartidas por todos los modales. */
export const CAMPO = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
/** Clases de la etiqueta del campo, compartidas por todos los modales. */
export const ETIQUETA = 'text-sm font-medium'

type PropsModalMarco = {
  /** Título de la cabecera. También alimenta el `aria-labelledby`. */
  title: string
  onClose: () => void
  /** Contenido del modal, dentro de la columna con `gap-3`. */
  children: ReactNode
  /** Pie con Cancelar / Guardar. Sin él, el modal no muestra pie. */
  footer?: ReactNode
  /** Aviso bajo el pie (p. ej. "Falta elegir al paciente."). */
  aviso?: ReactNode
}

export function ModalMarco({ title, onClose, children, footer, aviso }: PropsModalMarco) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="modal-title" className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">{children}</div>

        {footer}
        {aviso}
      </div>
    </div>
  )
}
