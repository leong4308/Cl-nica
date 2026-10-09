'use client'

import { useEffect, useState } from 'react'
import { Bed } from 'lucide-react'
import { cargarResumenCamas } from '@/lib/supabase/datos'
import { leerCamas } from '@/lib/supabase/cache-modulos'
import { BotonVerCamas } from './ver-camas-internaciones'

export function CamasInternacion({ onVerCamas }: { onVerCamas: () => void }) {
  const [camasResumen, setCamasResumen] = useState(() => leerCamas() ?? { ocupadas: 0, total: 0, libres: 0 })

  useEffect(() => {
    let vigente = true
    const cargarCamas = () => {
      void cargarResumenCamas().then((resultado) => {
        if (!vigente || resultado.error) return
        setCamasResumen(resultado.filas)
      })
    }
    cargarCamas()
    window.addEventListener('datos-actualizados', cargarCamas)
    return () => { vigente = false; window.removeEventListener('datos-actualizados', cargarCamas) }
  }, [])

  const porcentaje = camasResumen.total ? Math.round((camasResumen.ocupadas / camasResumen.total) * 100) : 0

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Camas e internación</h3>
        <Bed className="size-4 text-blue-600" />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div><p className="text-2xl font-bold">{camasResumen.ocupadas} <span className="text-sm font-normal text-slate-400">/ {camasResumen.total}</span></p><p className="text-xs text-slate-500">{porcentaje}% de ocupación</p></div>
        <div className="text-right text-xs"><p className="font-semibold text-emerald-600">{camasResumen.libres} libres</p><p className="text-slate-400">1 UCI libre</p></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${porcentaje}%` }} /></div>
      <BotonVerCamas onVerCamas={onVerCamas} />
    </section>
  )
}
