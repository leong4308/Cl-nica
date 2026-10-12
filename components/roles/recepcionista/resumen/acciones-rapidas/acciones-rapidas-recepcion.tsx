'use client'

import { CalendarPlus, Search, UserPlus } from 'lucide-react'
import type { ClinicActions } from '@/components/modulos/compartidos/types'

export function AccionesRapidasRecepcion({ openModal }: Pick<ClinicActions, 'openModal'>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => openModal('Registrar paciente')}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
      >
        <UserPlus size={16} />
        Registrar nuevo paciente
      </button>

      <button
        type="button"
        onClick={() => openModal('Nueva cita')}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 active:scale-95"
      >
        <CalendarPlus size={16} className="text-blue-600" />
        Agendar cita médica
      </button>

      <button
        type="button"
        onClick={() => openModal('Buscar paciente')}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95"
      >
        <Search size={16} className="text-slate-500" />
        Buscar en directorio
      </button>
    </div>
  )
}
