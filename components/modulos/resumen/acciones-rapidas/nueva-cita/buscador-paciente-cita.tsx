'use client'

import { useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'

type PacienteCita = { id: number; nombre: string }

type PropsBuscadorCita = {
  pacientes: PacienteCita[]
  seleccionadoId: number | null
  onSeleccionar: (id: number) => void
}

export function BuscadorPacienteCita({ pacientes, seleccionadoId, onSeleccionar }: PropsBuscadorCita) {
  const [texto, setTexto] = useState('')
  const [activo, setActivo] = useState(0)
  const [abierto, setAbierto] = useState(false)

  const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const coincidencias = pacientes
    .filter((p) => normalizar(p.nombre).includes(normalizar(texto)))
    .slice(0, 6)

  const seleccionado = pacientes.find((p) => p.id === seleccionadoId) ?? null

  function elegir(paciente: PacienteCita) {
    onSeleccionar(paciente.id)
    setTexto('')
    setAbierto(false)
    setActivo(0)
  }

  function alTeclado(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActivo((a) => Math.min(a + 1, coincidencias.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActivo((a) => Math.max(a - 1, 0))
    }
    if (event.key === 'Enter' && coincidencias[activo]) {
      event.preventDefault()
      elegir(coincidencias[activo])
    }
    if (event.key === 'Escape') setAbierto(false)
  }

  if (seleccionado) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
        <p className="text-xs font-semibold text-blue-700">Paciente seleccionado</p>
        <p className="mt-0.5 text-sm font-medium text-blue-900">{seleccionado.nombre}</p>
        <button
          type="button"
          onClick={() => onSeleccionar(0)}
          className="mt-2 rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
        >
          Cambiar paciente
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <label className="text-sm font-medium" htmlFor="buscar-paciente-cita">
        Paciente
      </label>
      <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-slate-400" />
      <input
        id="buscar-paciente-cita"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(0) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
        onKeyDown={alTeclado}
        autoComplete="off"
        placeholder="Escribe el nombre del paciente"
        className="mt-1 w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {abierto && texto && (
        coincidencias.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {coincidencias.map((paciente, i) => (
              <li key={paciente.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); elegir(paciente) }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${i === activo ? 'bg-blue-50' : ''}`}
                >
                  {paciente.nombre}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
            Sin coincidencias
          </p>
        )
      )}
    </div>
  )
}
