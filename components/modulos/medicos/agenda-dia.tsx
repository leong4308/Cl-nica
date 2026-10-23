'use client'

import { Clock, Play, FileText, User, RefreshCw, CheckCircle2, ChevronRight, Activity } from 'lucide-react'
import type { CitaAgendaMedico } from './types'

type AgendaDiaProps = {
  citas: CitaAgendaMedico[]
  citaSeleccionadaId: number
  onSeleccionarCita: (cita: CitaAgendaMedico) => void
  onIniciarConsulta: (cita: CitaAgendaMedico) => void
  onAbrirExpediente: (cita: CitaAgendaMedico) => void
  onRefrescar?: () => void
}

export function AgendaDia({
  citas,
  citaSeleccionadaId,
  onSeleccionarCita,
  onIniciarConsulta,
  onAbrirExpediente,
  onRefrescar,
}: AgendaDiaProps) {
  const formatearEstadoBadge = (estado: CitaAgendaMedico['estado']) => {
    switch (estado) {
      case 'en_espera':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En Sala de Espera
          </span>
        )
      case 'confirmada':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            Confirmada
          </span>
        )
      case 'atendida':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            <CheckCircle2 size={11} className="text-slate-500" />
            Atendida
          </span>
        )
      case 'pendiente':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            Pendiente
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {estado}
          </span>
        )
    }
  }

  const proximoListo = citas.find((c) => c.estado === 'en_espera')

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera de la Agenda */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Agenda del Día</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {citas.length} turnos programados {proximoListo ? '• Próximo paciente listo' : ''}
            </p>
          </div>
          {onRefrescar && (
            <button
              type="button"
              onClick={onRefrescar}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Actualizar agenda"
            >
              <RefreshCw size={15} />
            </button>
          )}
        </div>

        {/* Lista de Citas */}
        <div className="mt-4 flex flex-col gap-2.5">
          {citas.map((cita) => {
            const esActiva = cita.id === citaSeleccionadaId
            const esEnEspera = cita.estado === 'en_espera'

            return (
              <div
                key={cita.id}
                onClick={() => onSeleccionarCita(cita)}
                className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all ${
                  esActiva
                    ? 'border-blue-500 bg-blue-50/30 shadow-xs ring-1 ring-blue-500/20'
                    : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                {/* Barra superior de la tarjeta: Hora y Badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {cita.hora}
                    </span>
                    {formatearEstadoBadge(cita.estado)}
                  </div>

                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                      cita.tipoTurno === 'Primera Consulta'
                        ? 'bg-emerald-100/70 text-emerald-800'
                        : cita.tipoTurno === 'Recurrente'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cita.tipoTurno}
                  </span>
                </div>

                {/* Datos del Paciente */}
                <div className="mt-2.5 flex items-start gap-2.5">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      esActiva
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    <User size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {cita.pacienteNombre}
                      </p>
                      {esActiva && (
                        <span className="text-[10px] font-semibold text-blue-600">
                          Seleccionado
                        </span>
                      )}
                    </div>

                    <p className="truncate text-[11px] text-slate-500">
                      {cita.expedienteFolio} • {cita.edad} años • {cita.grupoSanguineo}
                    </p>

                    <p className="mt-1 line-clamp-1 text-[11px] font-medium text-slate-600">
                      {cita.motivo}
                    </p>
                  </div>
                </div>

                {/* Botones de Acción (Si está en espera o activa) */}
                {(esActiva || esEnEspera) && (
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100/80 pt-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onIniciarConsulta(cita)
                      }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98]"
                    >
                      <Play size={12} className="fill-white" />
                      Iniciar Consulta
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAbrirExpediente(cita)
                      }}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                      title="Abrir expediente completo"
                    >
                      <FileText size={13} className="text-slate-500" />
                      Expediente
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Widget Ocupación del Consultorio */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Activity size={15} className="text-blue-600" />
            Ocupación del Consultorio
          </span>
          <span className="font-mono text-xs font-bold text-blue-600">87% Hoy</span>
        </div>

        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: '87%' }} />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Tiempo prom. consulta: <strong className="font-semibold text-slate-700">22 min</strong></span>
          <span>Próxima cita libre: <strong className="font-semibold text-emerald-600">Mañana 10:15 AM</strong></span>
        </div>
      </div>
    </div>
  )
}
