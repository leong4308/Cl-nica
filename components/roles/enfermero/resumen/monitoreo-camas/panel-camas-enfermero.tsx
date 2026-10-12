'use client'

import { useEffect, useState } from 'react'
import { Bed, ArrowRight, Activity } from 'lucide-react'
import { cargarResumenCamas, type ResumenCamas } from '@/lib/supabase/datos'
import { leerCamas } from '@/lib/supabase/cache-modulos'

export function PanelCamasEnfermero({ onVerCamas }: { onVerCamas: () => void }) {
  const [camas, setCamas] = useState<ResumenCamas>(() => leerCamas() ?? { ocupadas: 0, total: 0, libres: 0 })

  useEffect(() => {
    let vigente = true
    const cargar = () => {
      void cargarResumenCamas().then((res) => {
        if (!vigente || res.error) return
        setCamas(res.filas)
      })
    }
    cargar()
    window.addEventListener('datos-actualizados', cargar)
    return () => {
      vigente = false
      window.removeEventListener('datos-actualizados', cargar)
    }
  }, [])

  const porcentaje = camas.total ? Math.round((camas.ocupadas / camas.total) * 100) : 0

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <Bed size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Ocupación hospitalaria y camas</h3>
            <p className="text-xs text-slate-400">Control de habitaciones y disponibilidad para internación</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onVerCamas}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-colors"
        >
          Ver módulo de camas
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-100">
          <p className="text-xs font-medium text-slate-500">Total de camas</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{camas.total}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Capacidad hospitalaria</p>
        </div>

        <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-100">
          <p className="text-xs font-medium text-blue-700">Camas ocupadas</p>
          <p className="mt-1 text-2xl font-bold text-blue-900">{camas.ocupadas}</p>
          <p className="mt-0.5 text-[11px] text-blue-600 font-medium">{porcentaje}% de ocupación</p>
        </div>

        <div className="rounded-xl bg-emerald-50/70 p-4 border border-emerald-100">
          <p className="text-xs font-medium text-emerald-700">Camas disponibles</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{camas.libres}</p>
          <p className="mt-0.5 text-[11px] text-emerald-600">Listas para admisión</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="font-medium text-slate-600 flex items-center gap-1">
            <Activity size={14} className="text-teal-600" />
            Capacidad hospitalaria en vivo
          </span>
          <span className="font-semibold text-slate-700">{porcentaje}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-500"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>
    </section>
  )
}
