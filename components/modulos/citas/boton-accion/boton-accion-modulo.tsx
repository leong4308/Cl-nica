import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonAccionModulo({ etiqueta, onAbrirModal }: { etiqueta: string; onAbrirModal: (titulo: string) => void }) {
  return <ActionButton primary icon={Plus} onClick={() => onAbrirModal(etiqueta)}>{etiqueta}</ActionButton>
}
