'use client'

import { useEffect, useState } from 'react'
import type { ClinicActions } from '../compartidos/types'
import { AccionesRapidas } from './acciones-rapidas'
import { Estadisticas } from './estadisticas'
import { ProximasCitas } from './proximas-citas'
import { CamasInternacion, MedicosEnTurno } from './paneles-laterales'

export function Dashboard({ notify, openModal, navigate, addAppointment }: ClinicActions) {
  const [ahora, setAhora] = useState(() => new Date())
  const acciones: ClinicActions = { notify, openModal, navigate, addAppointment }

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(new Date()), 30_000)
    return () => window.clearInterval(intervalo)
  }, [])

  const hora = ahora.getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const fecha = ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-600">{saludo}</p>
          <h2 className="text-[27px] font-bold tracking-tight">Resumen de Clínica Nova</h2>
          <p className="mt-1 text-sm capitalize text-slate-400">Sede principal · Turno matutino · {fecha}</p>
        </div>
        <AccionesRapidas {...acciones} />
      </div>

      <Estadisticas />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <ProximasCitas {...acciones} ahora={ahora} />

        <div className="space-y-6">
          <MedicosEnTurno />
          <CamasInternacion onVerCamas={() => navigate('Internación')} />
        </div>
      </div>
    </section>
  )
}
