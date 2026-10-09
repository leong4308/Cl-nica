import { Search } from 'lucide-react'
import { ActionButton } from '../../../compartidos/ui'

export function BotonBuscarPaciente({ onAbrirModal }: { onAbrirModal: (title: string) => void }) {
  return <ActionButton icon={Search} onClick={() => onAbrirModal('Buscar paciente')}>Buscar paciente</ActionButton>
}
