'use client'

import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonNuevaOrden({ onAbrirModal }: { onAbrirModal: (titulo: string) => void }) {
  return (
    <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Nueva orden')}>
      Nueva orden
    </ActionButton>
  )
}
