'use client'

import { useState, type FormEvent } from 'react'
import { ModalMarco } from '../../../compartidos/modal-marco'
import { UserRound, HeartPulse } from 'lucide-react'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, PanelClinico } from '../../../compartidos/editor-clinico'
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
      onClose={() => { if (!cargando) onClose() }}
      ancho="max-w-4xl"
      contenidoFijo
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Los campos con * son obligatorios.</p><div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={cargando}
            className={BOTON_SECUNDARIO}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-registrar-paciente"
            disabled={cargando || !datos.nombre.trim()}
            className={BOTON_PRIMARIO}
          >
            {cargando ? 'Guardando...' : 'Guardar paciente'}
          </button>
        </div></div>
      }
      aviso={
        error ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        ) : null
      }
    >
      <p className="mb-5 text-sm text-slate-500">Crea el perfil con los datos de contacto y los antecedentes del paciente.</p>
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
      <div className="min-w-0 space-y-5"><PanelClinico icon={UserRound} titulo="Nuevo paciente" ayuda="Identificación y contacto" suave><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-xl font-semibold text-blue-700">{datos.nombre.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || <UserRound size={28} />}</div><p className="break-words text-base font-semibold text-slate-900">{datos.nombre.trim() || 'Nombre del paciente'}</p><p className="mt-2 text-sm text-slate-500">{datos.telefono || 'Añade un teléfono de contacto.'}</p></PanelClinico><PanelClinico icon={HeartPulse} titulo="Antecedentes relevantes" ayuda="Incluye alergias o condiciones previas para facilitar la atención."><p className="text-sm leading-relaxed text-slate-500">Revisa el nombre y el teléfono antes de guardar el perfil.</p></PanelClinico></div>
      <PanelClinico icon={UserRound} titulo="Datos del paciente" ayuda="Completa la información que tengas disponible.">
      <form id="form-registrar-paciente" onSubmit={handleSubmit}>
        <CamposPaciente
          datos={datos}
          onChange={actualizarCampo}
          prefijoId="modal-paciente"
          disabled={cargando}
          autoFocusNombre
        />
      </form>
      </PanelClinico></div>
    </ModalMarco>
  )
}
