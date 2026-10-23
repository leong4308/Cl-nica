'use client'

import { useState, useEffect } from 'react'
import { Stethoscope, Plus, Search, Building2, Clock, CheckCircle2, Award, Calendar } from 'lucide-react'
import type { MedicoPerfil } from './types'
import { cargarMedicos } from '@/lib/supabase/datos'
import { BotonRegistrarMedico } from './registrar-medico'

type DirectorioMedicosProps = {
  medicos: MedicoPerfil[]
  onSeleccionarMedico: (medico: MedicoPerfil) => void
  onAbrirModal: (titulo: string) => void
  puedeRegistrar?: boolean
}

export function DirectorioMedicos({
  medicos,
  onSeleccionarMedico,
  onAbrirModal,
  puedeRegistrar,
}: DirectorioMedicosProps) {
  const [busqueda, setBusqueda] = useState('')

  const medicosFiltrados = medicos.filter(
    (m) =>
      m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.especialidad.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.cedula.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Barra de Filtros y Registro */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por médico, especialidad o cédula..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        {puedeRegistrar && <BotonRegistrarMedico onAbrirModal={onAbrirModal} />}
      </div>

      {/* Grid de Médicos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {medicosFiltrados.map((medico) => (
          <div
            key={medico.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-blue-300 hover:shadow-md"
          >
            <div>
              {/* Avatar e Identidad */}
              <div className="flex items-start gap-3.5">
                <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-xs">
                  <Stethoscope size={24} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                      {medico.nombre}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 size={10} /> Activo
                    </span>
                  </div>

                  <p className="truncate text-xs font-semibold text-blue-700">
                    {medico.especialidad}
                  </p>
                </div>
              </div>

              {/* Detalles Clínicos */}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Award size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">Cédula: <strong className="font-semibold text-slate-800">{medico.cedula}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{medico.clinica}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{medico.consultorio} • 20 min/consulta</span>
                </div>
              </div>
            </div>

            {/* Botón Ir a su Estación de Consulta */}
            <div className="mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onSeleccionarMedico(medico)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-blue-600 hover:text-white transition group-hover:bg-blue-50 group-hover:text-blue-700"
              >
                <Calendar size={14} />
                Abrir Estación & Agenda
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
