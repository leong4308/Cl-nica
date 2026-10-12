'use client'

import { ClipboardList } from 'lucide-react'
import type { ClinicActions } from '@/components/modulos/compartidos/types'
import { EstadisticasEnfermero } from './estadisticas/estadisticas-enfermero'
import { AccionesRapidasEnfermero } from './acciones-rapidas/acciones-rapidas-enfermero'
import { PanelCamasEnfermero } from './monitoreo-camas/panel-camas-enfermero'

type PropsDashboardEnfermero = ClinicActions & {
  nombreUsuario: string
}

export function DashboardEnfermero({
  nombreUsuario,
  openModal,
  navigate,
}: PropsDashboardEnfermero) {
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
          <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-[11px] font-semibold text-teal-800">
            Estación de Enfermería y Hospitalización
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Hola, {nombreUsuario}
          </h2>
          <p className="mt-1 text-xs text-slate-500 capitalize">{hoyFormateado}</p>
        </div>
        <AccionesRapidasEnfermero openModal={openModal} navigate={navigate} />
      </div>

      <EstadisticasEnfermero />

      <div className="grid gap-7 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PanelCamasEnfermero onVerCamas={() => navigate('Internación')} />
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Indicaciones y Órdenes</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('Órdenes médicas')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                Ver todas →
              </button>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-700">Administración de tratamientos</p>
              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                Revisa las órdenes prescritas por los médicos para suministrar medicamentos y actualizar su estado a realizado.
              </p>
              <button
                type="button"
                onClick={() => navigate('Órdenes médicas')}
                className="mt-3 w-full rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                Revisar órdenes médicas
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
