'use client'

import { Printer, AlertTriangle, User, ShieldAlert, Heart, Calendar } from 'lucide-react'
import type { CitaAgendaMedico } from './types'

type PacienteHeaderProps = {
  cita: CitaAgendaMedico
  onImprimirHistorial: () => void
  onAlertaUrgencias: () => void
}

export function PacienteHeader({
  cita,
  onImprimirHistorial,
  onAlertaUrgencias,
}: PacienteHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        
        {/* Paciente y Metadatos */}
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white font-bold text-lg shadow-sm">
              <User size={26} />
            </div>
            <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-white bg-emerald-500" title="Paciente en consulta" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {cita.pacienteNombre}
              </h2>

              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                Expediente Activo
              </span>

              {cita.alertas?.map((alerta) => (
                <span
                  key={alerta}
                  className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700"
                >
                  <ShieldAlert size={12} />
                  {alerta}
                </span>
              ))}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="font-mono font-medium text-slate-700">{cita.expedienteFolio}</span>
              <span className="text-slate-300">•</span>
              <span>{cita.edad} años</span>
              <span className="text-slate-300">•</span>
              <span>Masc.</span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <Heart size={12} className="text-rose-500 fill-rose-500" />
                Grupo {cita.grupoSanguineo}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">
                Última visita: <strong>hace 45 días (04 Sep)</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Botones de Acción Rápida */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onImprimirHistorial}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <Printer size={15} className="text-slate-500" />
            Imprimir Historial
          </button>

          <button
            type="button"
            onClick={onAlertaUrgencias}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-95 transition"
          >
            <AlertTriangle size={15} />
            Urgencias
          </button>
        </div>
      </div>
    </div>
  )
}
