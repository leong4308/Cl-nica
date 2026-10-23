'use client'

import { Calendar, ChevronLeft, ChevronRight, Stethoscope, UserCheck, Clock, CheckCircle2, Users, Building2 } from 'lucide-react'
import type { MedicoPerfil } from './types'

type MedicoHeaderProps = {
  medicos: MedicoPerfil[]
  medicoSeleccionado: MedicoPerfil
  onCambiarMedico: (medico: MedicoPerfil) => void
  fechaSeleccionada: Date
  onCambiarFecha: (deltaDias: number) => void
  onHoy: () => void
  totalCitas: number
  confirmadas: number
  pendientes: number
  atendidas: number
  vistaModo: 'estacion' | 'directorio'
  onCambiarVista: (modo: 'estacion' | 'directorio') => void
  esMedico?: boolean
  puedeCambiarMedico?: boolean
  puedeVerDirectorio?: boolean
}

export function MedicoHeader({
  medicos,
  medicoSeleccionado,
  onCambiarMedico,
  fechaSeleccionada,
  onCambiarFecha,
  onHoy,
  totalCitas,
  confirmadas,
  pendientes,
  atendidas,
  vistaModo,
  onCambiarVista,
  esMedico,
  puedeCambiarMedico,
  puedeVerDirectorio,
}: MedicoHeaderProps) {
  const formatoFecha = (fecha: Date) => {
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
    const texto = fecha.toLocaleDateString('es-MX', opciones)
    // Capitalizar primera letra
    const primeraLetra = texto.charAt(0).toUpperCase() + texto.slice(1)
    
    // Si es hoy:
    const hoy = new Date()
    const esHoy = hoy.toDateString() === fecha.toDateString()
    return esHoy ? `Hoy, ${primeraLetra}` : primeraLetra
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Perfil del Médico */}
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <Stethoscope size={28} className="stroke-[2.2]" />
            </div>
            <span className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white bg-emerald-500" title="En consulta activa" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Solo admin/recepcionista pueden cambiar de médico */}
              {medicos.length > 1 && puedeCambiarMedico ? (
                <select
                  value={medicoSeleccionado.id}
                  onChange={(e) => {
                    const m = medicos.find((item) => item.id === Number(e.target.value))
                    if (m) onCambiarMedico(m)
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-lg font-bold text-slate-900 transition hover:bg-slate-100 focus:border-blue-500 focus:outline-hidden"
                >
                  {medicos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {medicoSeleccionado.nombre}
                </h1>
              )}

              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold tracking-wider text-blue-700 uppercase">
                {medicoSeleccionado.especialidad}
              </span>

              {/* Indicador de rol para el médico — le recuerda que es SU panel */}
              {esMedico && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 size={10} />
                  Mi Consulta
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                Cédula Profesional: <strong className="font-semibold text-slate-700">{medicoSeleccionado.cedula}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1">
                <Building2 size={13} className="text-slate-400" />
                {medicoSeleccionado.clinica} — {medicoSeleccionado.consultorio}
              </span>
            </div>
          </div>
        </div>

        {/* Controles de Navegación de Fecha & Selector de Modo */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Switch Estación vs Directorio — solo visible para admin/recepcionista */}
          {puedeVerDirectorio && (
            <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onCambiarVista('estacion')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  vistaModo === 'estacion'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope size={14} />
                Estación de Consulta
              </button>
              <button
                type="button"
                onClick={() => onCambiarVista('directorio')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  vistaModo === 'directorio'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users size={14} />
                Directorio Staff
              </button>
            </div>
          )}

          {/* Navegador de Fecha */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => onCambiarFecha(-1)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              title="Día anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={onHoy}
              className="flex items-center gap-1.5 px-2.5 py-1 font-semibold text-slate-700 hover:text-blue-600"
            >
              <Calendar size={14} className="text-blue-600" />
              <span>{formatoFecha(fechaSeleccionada)}</span>
            </button>
            <button
              type="button"
              onClick={() => onCambiarFecha(1)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              title="Día siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Franja de Contadores y Métricas del Día */}
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50/70 px-4 py-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900">{totalCitas}</div>
            <div className="text-[11px] font-medium text-slate-500">Total Programadas</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-emerald-50/60 px-4 py-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <UserCheck size={18} />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-emerald-800">{confirmadas}</div>
            <div className="text-[11px] font-medium text-emerald-700">Confirmadas / Espera</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-amber-50/60 px-4 py-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-amber-800">{pendientes}</div>
            <div className="text-[11px] font-medium text-amber-700">Pendientes</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-indigo-50/60 px-4 py-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-indigo-800">{atendidas}</div>
            <div className="text-[11px] font-medium text-indigo-700">Atendidas Hoy</div>
          </div>
        </div>
      </div>
    </div>
  )
}
