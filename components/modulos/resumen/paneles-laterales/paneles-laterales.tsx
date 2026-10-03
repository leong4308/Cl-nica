'use client'

import { useEffect, useState } from 'react'
import { Bed, Stethoscope } from 'lucide-react'
import { cargarMedicosTurno, cargarResumenCamas } from '@/lib/supabase/datos'
import { leerCamas, leerMedicosTurno } from '@/lib/supabase/cache-modulos'

type MedicoEnTurno = { nombre: string; especialidad: string; estado: string }

export function MedicosEnTurno() {
  // Viene precargado, así que el panel no arranca vacío.
  const [doctoresEnTurno, setDoctoresEnTurno] = useState<MedicoEnTurno[]>(() => leerMedicosTurno() ?? [])

  useEffect(() => {
    let vigente = true
    const cargarMedicos = () => {
      void cargarMedicosTurno().then((resultado) => {
        if (!vigente || resultado.error) return
        setDoctoresEnTurno(resultado.filas)
      })
    }
    cargarMedicos()
    window.addEventListener('datos-actualizados', cargarMedicos)
    return () => { vigente = false; window.removeEventListener('datos-actualizados', cargarMedicos) }
  }, [])

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Médicos en turno</h3>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">{doctoresEnTurno.length} activos</span>
      </div>
      <div className="mt-4 space-y-3">
        {doctoresEnTurno.map(({ nombre: name, especialidad: specialty, estado: state }) => <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3" key={name}><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"><Stethoscope className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{name}</p><p className="truncate text-[11px] text-slate-500">{specialty}</p></div><span className={`text-[11px] font-semibold ${state === 'Disponible' ? 'text-emerald-600' : 'text-amber-600'}`}>{state}</span></div>)}
      </div>
    </section>
  )
}

export function CamasInternacion({ onVerCamas }: { onVerCamas: () => void }) {
  // También precargado: la ocupación se ve en el primer render.
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
      <button type="button" onClick={onVerCamas} className="mt-4 text-xs font-semibold text-blue-600">Ver camas e internaciones →</button>
    </section>
  )
}
