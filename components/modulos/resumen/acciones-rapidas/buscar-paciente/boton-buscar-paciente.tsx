import { Search } from 'lucide-react'
import { ActionButton } from '../../../compartidos/ui'

/**
 * Botón "Buscar paciente" de las acciones rápidas.
 *
 * Vive en `acciones-rapidas/buscar-paciente/`: abre el modal que también vive
 * aquí (`buscar-paciente/modal-buscar-paciente.tsx`).
 */
export function BotonBuscarPaciente({ onAbrirModal }: { onAbrirModal: (title: string) => void }) {
  return <ActionButton icon={Search} onClick={() => onAbrirModal('Buscar paciente')}>Buscar paciente</ActionButton>
}
