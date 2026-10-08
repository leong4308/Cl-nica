'use client'

import { useEffect, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { cargarMedicosTurno } from '@/lib/supabase/datos'
import { leerMedicosTurno } from '@/lib/supabase/cache-modulos'

type MedicoEnTurno = { nombre: string; especialidad: string; estado: string }

/**
 * Panel "Médicos en turno" del resumen.
 *
 * Vive en `paneles-laterales/medicos-en-turno/` porque es donde se pinta:
 * no es compartido, solo lo consume `resumen/dashboard.tsx`. No tiene
 * botones: es solo lectura desde Supabase.
 */
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
