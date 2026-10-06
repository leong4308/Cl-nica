'use client'

import { useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'

type Paciente = {
  nombre: string
  identificacion: string
  pass: string
  telefono: string
  estado: string
}

type PropsBuscador = {
  value: string
  onChange: (valor: string) => void
  resultados: Paciente[]
  resultadoActivo: number
  seleccionado: boolean
  onTeclado: (event: KeyboardEvent<HTMLInputElement>) => void
  onSeleccionar: (nombre: string) => void
}

export function BuscadorPaciente({
  value, onChange, resultados, resultadoActivo, seleccionado, onTeclado, onSeleccionar,
}: PropsBuscador) {
  return (
    <>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onTeclado}
          aria-label="Buscar paciente"
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Nombre, identificación o teléfono"
        />
        {value && !seleccionado && resultados.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {resultados.map((paciente, i) => (
              <button
                key={paciente.identificacion}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSeleccionar(paciente.nombre) }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 ${i === resultadoActivo ? 'bg-blue-50' : ''}`}
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{paciente.nombre}</span>
                  <span className="block text-xs text-slate-500">{paciente.pass} · {paciente.telefono}</span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">{paciente.estado}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {seleccionado && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
          Paciente seleccionado: {value}
        </p>
      )}
    </>
  )
}
