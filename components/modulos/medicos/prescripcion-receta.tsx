'use client'

import { useState } from 'react'
import { Pill, Plus, Trash2, Search, Sparkles } from 'lucide-react'
import type { MedicamentoPrescrito } from './types'
import { VADEMECUM_POPULAR } from './datos-medicos'

type PrescripcionRecetaProps = {
  prescripciones: MedicamentoPrescrito[]
  onActualizarPrescripciones: (nuevas: MedicamentoPrescrito[]) => void
}

export function PrescripcionReceta({
  prescripciones,
  onActualizarPrescripciones,
}: PrescripcionRecetaProps) {
  const [busqueda, setBusqueda] = useState('')
  const [mostrarVademecum, setMostrarVademecum] = useState(false)
  const [posologiaCustom, setPosologiaCustom] = useState('')
  const [presentacionCustom, setPresentacionCustom] = useState('')

  const handleAgregarFarmaco = (item: { nombre: string; presentacion: string; posologiaDefault: string }) => {
    const nuevo: MedicamentoPrescrito = {
      id: `farm-${Date.now()}`,
      nombre: item.nombre,
      tipo: prescripciones.length === 0 ? 'Nuevo' : 'Continuación',
      posologia: posologiaCustom.trim() || item.posologiaDefault,
      presentacion: presentacionCustom.trim() || item.presentacion,
    }

    onActualizarPrescripciones([...prescripciones, nuevo])
    setBusqueda('')
    setPosologiaCustom('')
    setPresentacionCustom('')
    setMostrarVademecum(false)
  }

  const handleAgregarManual = () => {
    if (!busqueda.trim()) return

    const nuevo: MedicamentoPrescrito = {
      id: `farm-${Date.now()}`,
      nombre: busqueda.trim(),
      tipo: 'Nuevo',
      posologia: posologiaCustom.trim() || '1 toma cada 24 horas según indicación médica.',
      presentacion: presentacionCustom.trim() || 'Caja x 30 unidades',
    }

    onActualizarPrescripciones([...prescripciones, nuevo])
    setBusqueda('')
    setPosologiaCustom('')
    setPresentacionCustom('')
    setMostrarVademecum(false)
  }

  const handleEliminar = (id: string) => {
    onActualizarPrescripciones(prescripciones.filter((p) => p.id !== id))
  }

  const sugerencias = VADEMECUM_POPULAR.filter((f) =>
    f.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      {/* Header */}
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <Pill size={14} />
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            Emisión de Receta y Prescripción Electrónica
          </h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          Vademécum Hospital Central v2024.5
        </span>
      </div>

      {/* Buscador de Principio Activo */}
      <div className="mb-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              value={busqueda}
              onFocus={() => setMostrarVademecum(true)}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setMostrarVademecum(true)
              }}
              placeholder="Buscar principio activo, marca o presentación (ej. Amlodipino, Losartán)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-4 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={() => setMostrarVademecum(!mostrarVademecum)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Plus size={14} />
            Añadir Fármaco
          </button>
        </div>

        {/* Panel Desplegable Vademécum */}
        {mostrarVademecum && (
          <div className="mt-2 rounded-xl border border-blue-200 bg-white p-3 shadow-md">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Vademécum Rápido de Prescripción
            </p>

            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {sugerencias.map((f) => (
                <div
                  key={f.nombre}
                  onClick={() => handleAgregarFarmaco(f)}
                  className="flex cursor-pointer items-center justify-between rounded-lg p-2 text-xs transition hover:bg-blue-50"
                >
                  <div>
                    <span className="font-bold text-slate-800">{f.nombre}</span>
                    <span className="ml-2 text-[11px] text-slate-500">({f.presentacion})</span>
                    <p className="text-[11px] text-slate-400">{f.posologiaDefault}</p>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white"
                  >
                    <Plus size={11} /> Seleccionar
                  </button>
                </div>
              ))}

              {busqueda.trim() && !sugerencias.some(s => s.nombre.toLowerCase() === busqueda.toLowerCase()) && (
                <div className="border-t border-slate-100 pt-2">
                  <div className="flex items-center justify-between rounded-lg p-2 bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-800">Prescribir fórmula manual: "{busqueda}"</span>
                      <p className="text-[11px] text-slate-500">Se registrará como prescripción personalizada</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAgregarManual}
                      className="rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
                    >
                      Añadir a la Receta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de Fármacos Prescritos */}
      {prescripciones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
          No hay fármacos prescritos aún. Utiliza el buscador superior para agregar tratamientos.
        </div>
      ) : (
        <div className="space-y-2.5">
          {prescripciones.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 transition hover:bg-slate-50"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-blue-100/70 text-blue-700 shrink-0">
                  <Pill size={14} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {p.nombre}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide ${
                        p.tipo === 'Nuevo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {p.tipo}
                    </span>
                  </div>

                  <p className="mt-0.5 text-xs text-slate-600 font-medium">
                    {p.posologia}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className="hidden font-mono text-xs text-slate-500 sm:inline-block">
                  {p.presentacion}
                </span>

                <button
                  type="button"
                  onClick={() => handleEliminar(p.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  title="Eliminar fármaco"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
