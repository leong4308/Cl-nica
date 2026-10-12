'use client'

import { Bed, CalendarPlus, Search, UserPlus } from 'lucide-react'
import type { ClinicActions } from '@/components/modulos/compartidos/types'

export function AccionesRapidasEnfermero({
  openModal,
  navigate,
}: Pick<ClinicActions, 'openModal' | 'navigate'>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => openModal('Registrar paciente')}
        className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-teal-200 transition-all hover:bg-teal-700 active:scale-95"
      >
        <UserPlus size={16} />
        Ingreso urgente de paciente
      </button>

      <button
        type="button"
        onClick={() => openModal('Nueva cita')}
        className="inline-flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-3.5 py-2.5 text-xs font-semibold text-teal-700 shadow-sm transition-all hover:bg-teal-100 active:scale-95"
      >
        <CalendarPlus size={16} className="text-teal-600" />
        Nueva cita
      </button>

      <button
        type="button"
        onClick={() => navigate('Internación')}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-700 active:scale-95"
      >
        <Bed size={16} className="text-teal-600" />
        Gestión de camas
      </button>

      <button
        type="button"
        onClick={() => openModal('Buscar paciente')}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95"
      >
        <Search size={16} className="text-slate-500" />
        Buscar paciente
      </button>
    </div>
  )
}
