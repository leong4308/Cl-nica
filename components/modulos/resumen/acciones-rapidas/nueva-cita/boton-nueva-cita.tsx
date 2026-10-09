import { Plus } from 'lucide-react'
import { ActionButton } from '../../../compartidos/ui'

export function BotonNuevaCita({ onAbrirModal }: { onAbrirModal: (title: string) => void }) {
  return <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Nueva cita')}>Nueva cita</ActionButton>
}
