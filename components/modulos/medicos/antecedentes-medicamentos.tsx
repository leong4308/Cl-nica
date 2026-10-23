'use client'

import { History, Pill, CheckCircle, Clock } from 'lucide-react'
import type { ConsultaPrevia, MedicamentoRecurrente } from './types'

type AntecedentesMedicamentosProps = {
  consultasPrevias?: ConsultaPrevia[]
  medicamentosActivos?: MedicamentoRecurrente[]
}

export function AntecedentesMedicamentos({
  consultasPrevias = [],
  medicamentosActivos = [],
}: AntecedentesMedicamentosProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      
      {/* Columna 1: Línea de Tiempo de Consultas Previas */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <History size={14} />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Línea de Tiempo de Consultas Previas
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            {consultasPrevias.length} registros
          </span>
        </div>

        {consultasPrevias.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No hay consultas previas registradas para este paciente.
          </p>
        ) : (
          <div className="relative border-l border-slate-200 ml-2 space-y-4 py-1">
            {consultasPrevias.map((c) => (
              <div key={c.id} className="relative pl-5">
                <span className="absolute -left-[5px] top-1.5 size-2 rounded-full border border-white bg-blue-600 ring-4 ring-blue-50" />
                
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {c.fecha}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {c.especialidad} · {c.medico}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {c.resumen}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Columna 2: Medicamentos Activos Recurrentes */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <Pill size={14} />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Medicamentos Activos Recurrentes
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            {medicamentosActivos.length} activos
          </span>
        </div>

        {medicamentosActivos.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            El paciente no tiene medicamentos recurrentes activos.
          </p>
        ) : (
          <div className="space-y-2.5">
            {medicamentosActivos.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-slate-200"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {m.nombre}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {m.dosis}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {m.frecuencia} • {m.via}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle size={10} />
                  Activo
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
