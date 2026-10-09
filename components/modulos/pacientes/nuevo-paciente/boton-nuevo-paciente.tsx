'use client'

import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonNuevoPaciente({ onAbrirModal }: { onAbrirModal: (titulo: string) => void }) {
  return (
    <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Nuevo paciente')}>
      Nuevo paciente
    </ActionButton>
  )
}
