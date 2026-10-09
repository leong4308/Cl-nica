'use client'

import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonNuevaAdmision({ onAbrirModal }: { onAbrirModal: (titulo: string) => void }) {
  return (
    <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Nueva admisión')}>
      Nueva admisión
    </ActionButton>
  )
}
