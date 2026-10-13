'use client'

import { useState, type KeyboardEvent, type FormEvent } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import {
  CamposPaciente,
  DATOS_PACIENTE_INICIALES,
  payloadPaciente,
  type DatosPacienteFormulario,
} from '@/components/modulos/compartidos/campos-paciente'

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
  onPacienteCreado?: () => void
}

export function BuscadorPaciente({
  value, onChange, resultados, resultadoActivo, seleccionado, onTeclado, onSeleccionar, onPacienteCreado,
}: PropsBuscador) {
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false)
  const [datosNuevo, setDatosNuevo] = useState<DatosPacienteFormulario>(DATOS_PACIENTE_INICIALES)
  const [guardando, setGuardando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState('')

  const actualizarCampo = <K extends keyof DatosPacienteFormulario>(
    campo: K,
    valor: DatosPacienteFormulario[K],
  ) => {
    setDatosNuevo((prev: DatosPacienteFormulario) => ({ ...prev, [campo]: valor }))
  }

  function abrirFormulario() {
    setDatosNuevo({ ...DATOS_PACIENTE_INICIALES, nombre: value })
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
    setGuardando(true)
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
      onSeleccionar(data.nombre || datosNuevo.nombre.trim())
      onPacienteCreado?.()
      cerrarFormulario()
    } catch (err: unknown) {
      setErrorNuevo(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setGuardando(false)
    }
  }

  const sinCoincidencias = value.length > 0 && !seleccionado && resultados.length === 0

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

        <form id="form-nuevo-paciente-busqueda" onSubmit={guardarNuevoPaciente} className="flex flex-col gap-3">
          <CamposPaciente
            datos={datosNuevo}
            onChange={actualizarCampo}
            prefijoId="nuevo-busq"
            disabled={guardando}
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
              disabled={guardando}
              className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-nuevo-paciente-busqueda"
              disabled={guardando}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Registrar paciente'}
            </button>
          </div>
        </form>
      </div>
    )
  }

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
      </div>

      {/* Resultados inline (no absolute) para que no se recorten con overflow del modal */}
      {value && !seleccionado && resultados.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {resultados.map((paciente, i) => (
            <button
              key={paciente.identificacion}
              type="button"
              onClick={() => onSeleccionar(paciente.nombre)}
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

      {sinCoincidencias && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="px-3 pt-3 pb-1 text-xs text-slate-500">
            No se encontró <span className="font-semibold text-slate-700">"{value}"</span>
          </p>
          <button
            type="button"
            onClick={abrirFormulario}
            className="flex w-full items-center gap-2 rounded-b-xl px-3 py-2.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <UserPlus size={14} />
            Crear paciente "{value}"
          </button>
        </div>
      )}

      {seleccionado && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
          Paciente seleccionado: {value}
        </p>
      )}
    </>
  )
}
