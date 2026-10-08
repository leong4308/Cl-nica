'use client'

import { X } from 'lucide-react'

/**
 * Botón ✕ de cierre del modal de acciones.
 *
 * Vive en `proximas-citas/cerrar-modal/` porque lo usan AMBAS vistas del
 * modal (`modal-accion-cita.tsx`: detalle y reagendar): cierra sin guardar.
 */
export function BotonCerrarModal({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
  )
}
