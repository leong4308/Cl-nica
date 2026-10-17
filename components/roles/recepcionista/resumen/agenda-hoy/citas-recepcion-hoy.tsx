'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Clock, User } from 'lucide-react'
import { cargarCitasPanel, type CitaPanel } from '@/lib/supabase/datos'
import { leerPanel, guardarPanel } from '@/lib/supabase/cache-modulos'

type PropsCitasRecepcion = {
  onAbrirCita: (cita: CitaPanel, accion: 'detalle' | 'reagendar') => void
  onNuevaCita: () => void
}

export function CitasRecepcionHoy({ onAbrirCita, onNuevaCita }: PropsCitasRecepcion) {
  const [citas, setCitas] = useState<CitaPanel[]>(() => leerPanel()?.filas ?? [])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    let vigente = true
    const cargar = () => {
      setCargando(true)
      void cargarCitasPanel().then((res) => {
        if (!vigente) return
        setCitas(res.filas)
        guardarPanel(res.filas, res.error)
        setCargando(false)
      })
    }
    cargar()
    window.addEventListener('datos-actualizados', cargar)
    return () => {
      vigente = false
      window.removeEventListener('datos-actualizados', cargar)
    }
  }, [])

  const solicitudesReagenda = citas.filter((c) => c.solicitaReagenda)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Cabecera */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Agenda de recepción · Pacientes por atender</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Control de citas, agendamiento y solicitudes de reagenda médica.
          </p>
        </div>
        <button
          type="button"
          onClick={onNuevaCita}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
        >
          + Agendar cita
        </button>
      </div>

      {/* Banner: solicitudes de reagenda del médico */}
      {solicitudesReagenda.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold text-amber-900">
                📋{' '}
                {solicitudesReagenda.length === 1
                  ? '1 solicitud de reagenda pendiente del médico'
                  : `${solicitudesReagenda.length} solicitudes de reagenda pendientes del médico`}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800 leading-relaxed">
                {solicitudesReagenda.length === 1
                  ? `El Dr(a). ${solicitudesReagenda[0].medico} solicitó reagendar la cita de ${solicitudesReagenda[0].paciente}. Asigna la fecha más próxima disponible.`
                  : 'Los médicos han solicitado reagendar estas citas. Asigna la fecha más próxima disponible para cada paciente.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAbrirCita(solicitudesReagenda[0], 'reagendar')}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-sm"
            >
              Asignar fecha más próxima →
            </button>
          </div>
        </div>
      )}

      {/* Lista de citas */}
      <div className="mt-5 divide-y divide-slate-100">
        {citas.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            {cargando ? 'Cargando agenda...' : 'No hay pacientes programados para el día de hoy.'}
          </div>
        ) : (
          citas.slice(0, 8).map((cita) => (
            <div
              key={cita.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0 ${
                cita.solicitaReagenda ? 'rounded-lg bg-amber-50/60 px-2 -mx-2' : ''
              }`}
            >
              {/* Info del paciente */}
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                    cita.solicitaReagenda ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <User size={16} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{cita.paciente}</p>
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        cita.estado === 'Confirmada'
                          ? 'bg-blue-50 text-blue-700'
                          : cita.estado === 'Atendida'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {cita.estado}
                    </span>
                    {cita.solicitaReagenda && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Reagenda solicitada por médico
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Dr(a). {cita.medico} ·{' '}
                    <span className="font-medium text-slate-700">{cita.motivo}</span>
                  </p>
                </div>
              </div>

              {/* Hora y acciones */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <Clock size={14} className="text-slate-400" />
                  <span>{cita.hora}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {cita.solicitaReagenda ? (
                    <button
                      type="button"
                      onClick={() => onAbrirCita(cita, 'reagendar')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-sm"
                    >
                      Asignar fecha más próxima
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAbrirCita(cita, 'reagendar')}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Reagendar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
