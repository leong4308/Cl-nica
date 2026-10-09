'use client'

import type { DiaDisponible } from '@/lib/supabase/datos'

export function BotonesDiaReagenda({
  dias, fecha, onFecha,
}: {
  dias: DiaDisponible[]
  fecha: string
  onFecha: (fecha: string) => void
}) {
  return (
    <>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Día</p>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {dias.map((dia) => (
          <button type="button" key={dia.fecha} onClick={() => onFecha(dia.fecha)} aria-pressed={fecha === dia.fecha} className={`rounded-lg border px-2 py-2 text-center text-xs ${fecha === dia.fecha ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'}`}>
            <span className="block font-semibold text-slate-800">{dia.etiqueta}</span>
          </button>
        ))}
      </div>
    </>
  )
}
