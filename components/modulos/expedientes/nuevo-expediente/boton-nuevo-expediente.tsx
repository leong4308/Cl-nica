'use client'

import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonNuevoExpediente({ onAbrirModal }: { onAbrirModal: (titulo: string) => void }) {
  return (
    <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Nuevo expediente')}>
      Nuevo expediente
    </ActionButton>
  )
}
