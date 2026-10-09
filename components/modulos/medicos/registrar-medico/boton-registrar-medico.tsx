'use client'

import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonRegistrarMedico({ onAbrirModal }: { onAbrirModal: (titulo: string) => void }) {
  return (
    <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Registrar médico')}>
      Registrar médico
    </ActionButton>
  )
}
