'use client'

import { Plus, Search } from 'lucide-react'
import { quickLinks } from '../../compartidos/data'
import type { ClinicActions } from '../../compartidos/types'
import { ActionButton } from '../../compartidos/ui'

export function AccionesRapidas({ openModal }: ClinicActions) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton icon={Search} onClick={() => openModal('Buscar paciente')}>Buscar paciente</ActionButton>
      <ActionButton primary icon={Plus} onClick={() => openModal('Nueva cita')}>Nueva cita</ActionButton>
      {quickLinks.slice(0, 3).map((item) => <button type="button" key={item} onClick={() => openModal(item)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{item}</button>)}
    </div>
  )
}
