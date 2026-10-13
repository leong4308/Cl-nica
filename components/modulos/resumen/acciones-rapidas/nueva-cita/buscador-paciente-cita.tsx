'use client'

import { useState, type KeyboardEvent, type FormEvent } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import {
  CamposPaciente,
  DATOS_PACIENTE_INICIALES,
  payloadPaciente,
  type DatosPacienteFormulario,
} from '@/components/modulos/compartidos/campos-paciente'

type PacienteCita = { id: number; nombre: string }

type PropsBuscadorCita = {
  pacientes: PacienteCita[]
  seleccionadoId: number | null
  onSeleccionar: (id: number) => void
  onPacienteCreado?: (paciente: PacienteCita) => void
}

export function BuscadorPacienteCita({ pacientes, seleccionadoId, onSeleccionar, onPacienteCreado }: PropsBuscadorCita) {
  const [texto, setTexto] = useState('')
  const [activo, setActivo] = useState(0)
  const [abierto, setAbierto] = useState(false)
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false)

  // Estado del mini-formulario
  const [datosNuevo, setDatosNuevo] = useState<DatosPacienteFormulario>(DATOS_PACIENTE_INICIALES)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState('')

  const actualizarCampoNuevo = <K extends keyof DatosPacienteFormulario>(
    campo: K,
    valor: DatosPacienteFormulario[K],
  ) => {
    setDatosNuevo((prev: DatosPacienteFormulario) => ({ ...prev, [campo]: valor }))
  }

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

  function abrirFormulario() {
    setAbierto(false)
    setDatosNuevo({ ...DATOS_PACIENTE_INICIALES, nombre: texto })
    setMostrandoFormulario(true)
  }

  function cerrarFormulario() {
    setMostrandoFormulario(false)
    setDatosNuevo(DATOS_PACIENTE_INICIALES)
    setErrorNuevo('')
  }

  async function guardarNuevoPaciente(event: FormEvent) {
    event.preventDefault()
    if (!datosNuevo.nombre.trim()) {
      setErrorNuevo('El nombre completo es obligatorio.')
      return
    }
    setGuardandoNuevo(true)
    setErrorNuevo('')
    try {
      const response = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadPaciente(datosNuevo)),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar.')

      window.dispatchEvent(new Event('datos-actualizados'))

      const nuevoPaciente: PacienteCita = { id: data.id, nombre: data.nombre || datosNuevo.nombre.trim() }
      onPacienteCreado?.(nuevoPaciente)
      onSeleccionar(nuevoPaciente.id)
      cerrarFormulario()
      setTexto('')
    } catch (err: unknown) {
      setErrorNuevo(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setGuardandoNuevo(false)
    }
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

  if (mostrandoFormulario) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus size={15} className="text-emerald-600" />
            <p className="text-sm font-bold text-emerald-800">Registrar nuevo paciente</p>
          </div>
          <button
            type="button"
            onClick={cerrarFormulario}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cancelar nuevo paciente"
          >
            <X size={15} />
          </button>
        </div>

        <form id="form-nuevo-paciente-cita" onSubmit={guardarNuevoPaciente} className="flex flex-col gap-3">
          <CamposPaciente
            datos={datosNuevo}
            onChange={actualizarCampoNuevo}
            prefijoId="nuevo-pac"
            disabled={guardandoNuevo}
            autoFocusNombre
          />

          {errorNuevo && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {errorNuevo}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={cerrarFormulario}
              disabled={guardandoNuevo}
              className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-nuevo-paciente-cita"
              disabled={guardandoNuevo}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {guardandoNuevo ? 'Guardando...' : 'Registrar y seleccionar'}
            </button>
          </div>
        </form>
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
        onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
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
          <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg">
            <p className="px-3 pt-3 pb-1 text-xs text-slate-500">
              No se encontró <span className="font-semibold text-slate-700">"{texto}"</span>
            </p>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); abrirFormulario() }}
              className="flex w-full items-center gap-2 rounded-b-xl px-3 py-2.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <UserPlus size={14} />
              Crear paciente "{texto}"
            </button>
          </div>
        )
      )}
    </div>
  )
}
