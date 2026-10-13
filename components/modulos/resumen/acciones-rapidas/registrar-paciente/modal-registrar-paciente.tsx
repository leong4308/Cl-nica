'use client'

import { useState, type FormEvent } from 'react'
import { ModalMarco } from '../../../compartidos/modal-marco'
import {
  CamposPaciente,
  DATOS_PACIENTE_INICIALES,
  payloadPaciente,
  type DatosPacienteFormulario,
} from '../../../compartidos/campos-paciente'

type PropsModalRegistrarPaciente = {
  onClose: () => void
  onSave: (nombre: string) => void
}

export function ModalRegistrarPaciente({ onClose, onSave }: PropsModalRegistrarPaciente) {
  const [datos, setDatos] = useState<DatosPacienteFormulario>(DATOS_PACIENTE_INICIALES)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actualizarCampo = <K extends keyof DatosPacienteFormulario>(
    campo: K,
    valor: DatosPacienteFormulario[K],
  ) => {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!datos.nombre.trim()) {
      setError('El nombre completo es obligatorio.')
      return
    }
    setCargando(true)
    setError(null)

    try {
      const response = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadPaciente(datos)),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo registrar el paciente.')
      }

      window.dispatchEvent(new Event('datos-actualizados'))
      onSave(data.nombre || datos.nombre)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <ModalMarco
      title="Registrar nuevo paciente"
      onClose={onClose}
      footer={
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={cargando}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-registrar-paciente"
            disabled={cargando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {cargando ? 'Guardando...' : 'Guardar paciente'}
          </button>
        </div>
      }
      aviso={
        error ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        ) : null
      }
    >
      <form id="form-registrar-paciente" onSubmit={handleSubmit}>
        <CamposPaciente
          datos={datos}
          onChange={actualizarCampo}
          prefijoId="modal-paciente"
          disabled={cargando}
          autoFocusNombre
        />
      </form>
    </ModalMarco>
  )
}
