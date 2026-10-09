'use client'

import { useState, type FormEvent } from 'react'
import { ModalMarco, CAMPO, ETIQUETA } from '../../../compartidos/modal-marco'

type PropsModalRegistrarPaciente = {
  onClose: () => void
  onSave: (nombre: string) => void
}

export function ModalRegistrarPaciente({ onClose, onSave }: PropsModalRegistrarPaciente) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [genero, setGenero] = useState('M')
  const [contactoEmergencia, setContactoEmergencia] = useState('')
  const [telefonoEmergencia, setTelefonoEmergencia] = useState('')
  const [notasMedicas, setNotasMedicas] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!nombre.trim()) {
      setError('El nombre completo es obligatorio.')
      return
    }
    setCargando(true)
    setError(null)

    try {
      const response = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          correo: correo.trim() || undefined,
          telefono: telefono.trim() || undefined,
          fechaNacimiento: fechaNacimiento || undefined,
          genero,
          contactoEmergencia: contactoEmergencia.trim() || undefined,
          telefonoEmergencia: telefonoEmergencia.trim() || undefined,
          notasMedicas: notasMedicas.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo registrar el paciente.')
      }

      window.dispatchEvent(new Event('datos-actualizados'))
      onSave(data.nombre || nombre)
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
      <form id="form-registrar-paciente" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="paciente-nombre" className={ETIQUETA}>
            Nombre completo <span className="text-rose-500">*</span>
          </label>
          <input
            id="paciente-nombre"
            type="text"
            required
            placeholder="Ej. Juan Pérez González"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={CAMPO}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="paciente-correo" className={ETIQUETA}>
              Correo electrónico
            </label>
            <input
              id="paciente-correo"
              type="email"
              placeholder="juan@ejemplo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={CAMPO}
            />
          </div>
          <div>
            <label htmlFor="paciente-tel" className={ETIQUETA}>
              Teléfono
            </label>
            <input
              id="paciente-tel"
              type="tel"
              placeholder="55 1234 5678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={CAMPO}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="paciente-fecha-nac" className={ETIQUETA}>
              Fecha de nacimiento
            </label>
            <input
              id="paciente-fecha-nac"
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className={CAMPO}
            />
          </div>
          <div>
            <label htmlFor="paciente-genero" className={ETIQUETA}>
              Género
            </label>
            <select
              id="paciente-genero"
              value={genero}
              onChange={(e) => setGenero(e.target.value)}
              className={CAMPO}
            >
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="O">Otro</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="paciente-contacto-emergencia" className={ETIQUETA}>
              Contacto de emergencia
            </label>
            <input
              id="paciente-contacto-emergencia"
              type="text"
              placeholder="Nombre de familiar"
              value={contactoEmergencia}
              onChange={(e) => setContactoEmergencia(e.target.value)}
              className={CAMPO}
            />
          </div>
          <div>
            <label htmlFor="paciente-tel-emergencia" className={ETIQUETA}>
              Tel. emergencia
            </label>
            <input
              id="paciente-tel-emergencia"
              type="tel"
              placeholder="55 9876 5432"
              value={telefonoEmergencia}
              onChange={(e) => setTelefonoEmergencia(e.target.value)}
              className={CAMPO}
            />
          </div>
        </div>

        <div>
          <label htmlFor="paciente-notas" className={ETIQUETA}>
            Notas médicas o antecedentes
          </label>
          <textarea
            id="paciente-notas"
            rows={2}
            placeholder="Alergias, condiciones previas, etc."
            value={notasMedicas}
            onChange={(e) => setNotasMedicas(e.target.value)}
            className={CAMPO}
          />
        </div>
      </form>
    </ModalMarco>
  )
}
