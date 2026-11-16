'use client'

import { useEffect, useState } from 'react'
import type { ClinicActions } from '../compartidos/types'
import { AccionesRapidas } from './acciones-rapidas'
import { Estadisticas } from './estadisticas'
import { ProximasCitas } from './proximas-citas'
import { CamasInternacion, MedicosEnTurno } from './paneles-laterales'

export function Dashboard({ notify, openModal, navigate, addAppointment, onAccion, rol }: ClinicActions) {
  const [ahora, setAhora] = useState(() => new Date())
  const acciones: ClinicActions = { notify, openModal, navigate, addAppointment, onAccion, rol }

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(new Date()), 30_000)
    return () => window.clearInterval(intervalo)
  }, [])

  const hora = Number(ahora.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', hourCycle: 'h23' }))
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const fecha = ahora.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-600">{saludo}</p>
          <h2 className="text-[27px] font-bold tracking-tight">Resumen de Clínica Nova</h2>
          <p className="mt-1 text-sm capitalize text-slate-400">Administración · {fecha} · Hora de Ciudad de México</p>
        </div>
        <AccionesRapidas {...acciones} />
      </div>

      {rol === 'admin' && <section aria-label="Herramientas de administración" className="mb-6 grid gap-3 sm:grid-cols-3">
        {[{ titulo: 'Habitaciones y camas', detalle: 'Crear ubicaciones y gestionar su disponibilidad', accion: () => openModal('Administrar camas') }, { titulo: 'Usuarios y permisos', detalle: 'Administrar cuentas y accesos del personal', accion: () => openModal('Usuarios') }, { titulo: 'Historial de cambios', detalle: 'Consultar quién realizó cada modificación', accion: () => openModal('Historial de cambios') }].map(item => <button key={item.titulo} onClick={item.accion} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50"><span className="block text-sm font-semibold text-slate-800">{item.titulo} →</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.detalle}</span></button>)}
      </section>}
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
