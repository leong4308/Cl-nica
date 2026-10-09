import { Filter } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonFiltrarModulo({ modulo, onAbrirModal }: { modulo: string; onAbrirModal: (titulo: string) => void }) {
  return <ActionButton icon={Filter} onClick={() => onAbrirModal(`Filtros de ${modulo}`)}>Filtrar</ActionButton>
}
