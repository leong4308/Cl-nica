'use client'

import { useEffect, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import type { ClinicActions } from '@/components/modulos/compartidos/types'
import { cargarMedicosTurno, type CitaPanel, type MedicoTurno } from '@/lib/supabase/datos'
import { leerMedicosTurno } from '@/lib/supabase/cache-modulos'
import { EstadisticasRecepcion } from './estadisticas/estadisticas-recepcion'
import { AccionesRapidasRecepcion } from './acciones-rapidas/acciones-rapidas-recepcion'
import { CitasRecepcionHoy } from './agenda-hoy/citas-recepcion-hoy'

type PropsDashboardRecepcion = ClinicActions & {
  nombreUsuario: string
  onAccionCita: (cita: CitaPanel, accion: 'detalle' | 'reagendar') => void
}

export function DashboardRecepcionista({
  nombreUsuario,
  openModal,
  onAccionCita,
}: PropsDashboardRecepcion) {
  const [medicos, setMedicos] = useState<MedicoTurno[]>(() => leerMedicosTurno() ?? [])

  useEffect(() => {
    let vigente = true
    const cargar = () => {
      void cargarMedicosTurno().then((res) => {
        if (!vigente || res.error) return
        setMedicos(res.filas)
      })
    }
    cargar()
    window.addEventListener('datos-actualizados', cargar)
    return () => {
      vigente = false
      window.removeEventListener('datos-actualizados', cargar)
    }
  }, [])

  const hoyFormateado = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold text-blue-800">
            Módulo de Recepción y Admisión
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Hola, {nombreUsuario}
          </h2>
          <p className="mt-1 text-xs text-slate-500 capitalize">{hoyFormateado}</p>
        </div>
        <AccionesRapidasRecepcion openModal={openModal} />
      </div>

      <EstadisticasRecepcion />

      <div className="grid gap-7 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CitasRecepcionHoy
            onAbrirCita={onAccionCita}
            onNuevaCita={() => openModal('Nueva cita')}
          />
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Stethoscope size={18} className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Médicos de consulta hoy</h3>
            </div>
            <div className="mt-3 divide-y divide-slate-50">
              {medicos.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">Sin médicos disponibles</p>
              ) : (
                medicos.slice(0, 5).map((medico, idx) => (
                  <div key={`${medico.nombre}-${idx}`} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{medico.nombre}</p>
                      <p className="text-[11px] text-slate-400">{medico.especialidad}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      En turno
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
