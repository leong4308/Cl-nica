import { Plus } from 'lucide-react'
import { ActionButton } from '../../../compartidos/ui'

/**
 * Botón "Nueva cita" de las acciones rápidas.
 *
 * Vive en `acciones-rapidas/nueva-cita/`: abre el modal que también vive
 * aquí (`nueva-cita/modal-nueva-cita.tsx`).
 */
export function BotonNuevaCita({ onAbrirModal }: { onAbrirModal: (title: string) => void }) {
  return <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Nueva cita')}>Nueva cita</ActionButton>
}
