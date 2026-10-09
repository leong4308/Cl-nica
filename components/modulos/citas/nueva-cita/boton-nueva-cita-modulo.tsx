import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonNuevaCitaModulo({ onAbrirModal }: { onAbrirModal: (titulo: string) => void }) {
  return <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Nueva cita')}>Nueva cita</ActionButton>
}
