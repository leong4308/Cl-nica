'use client'

import { useEffect, useState } from 'react'
import { ModalMarco, CAMPO, ETIQUETA } from '../../compartidos/modal-marco'
import {
  cargarOpcionesInternacion,
  crearInternacion,
  type OpcionSelector,
} from '@/lib/supabase/datos'
import { AlertCircle, Bed, User, Stethoscope } from 'lucide-react'

type PropsModalNuevaAdmision = {
  onClose: () => void
  onSave?: (mensaje: string) => void
}

export function ModalNuevaAdmision({ onClose, onSave }: PropsModalNuevaAdmision) {
  const [pacientes, setPacientes] = useState<OpcionSelector[]>([])
  const [medicos, setMedicos] = useState<OpcionSelector[]>([])
  const [camas, setCamas] = useState<
    { id: number; habitacionId: number; numero: string; habitacion: string }[]
  >([])

  const [pacienteId, setPacienteId] = useState<number | ''>('')
  const [medicoId, setMedicoId] = useState<number | ''>('')
  const [camaId, setCamaId] = useState<number | ''>('')
  const [motivoIngreso, setMotivoIngreso] = useState('')
  const [diagnosticoIngreso, setDiagnosticoIngreso] = useState('')

  const [cargandoOpciones, setCargandoOpciones] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    cargarOpcionesInternacion().then((res) => {
      if (!vigente) return
      setPacientes(res.pacientes)
      setMedicos(res.medicos)
      setCamas(res.camasDisponibles)
      if (res.pacientes[0]) setPacienteId(res.pacientes[0].id)
      if (res.medicos[0]) setMedicoId(res.medicos[0].id)
      if (res.camasDisponibles[0]) setCamaId(res.camasDisponibles[0].id)
      if (res.error) setError(res.error)
      setCargandoOpciones(false)
    })
    return () => {
      vigente = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteId || !medicoId || !camaId) {
      setError('Por favor selecciona paciente, médico responsable y cama.')
      return
    }
    if (!motivoIngreso.trim()) {
      setError('El motivo de ingreso es obligatorio.')
      return
    }

    const camaSeleccionada = camas.find((c) => c.id === Number(camaId))
    if (!camaSeleccionada) {
      setError('Cama no válida o ya ocupada.')
      return
    }

    setGuardando(true)
    setError(null)

    const res = await crearInternacion({
      pacienteId: Number(pacienteId),
      medicoId: Number(medicoId),
      camaId: Number(camaId),
      habitacionId: camaSeleccionada.habitacionId,
      motivoIngreso: motivoIngreso.trim(),
      diagnosticoIngreso: diagnosticoIngreso.trim() || 'Evaluación en hospitalización',
    })

    setGuardando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    const pacNombre = pacientes.find((p) => p.id === Number(pacienteId))?.nombre ?? 'Paciente'
    if (onSave) onSave(`Admisión de ${pacNombre} registrada correctamente`)
    onClose()
  }

  return (
    <ModalMarco
      title="Nueva admisión hospitalaria"
      onClose={onClose}
      footer={
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-nueva-admision"
            disabled={guardando || cargandoOpciones || camas.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando admisión...' : 'Registrar ingreso'}
          </button>
        </div>
      }
    >
      <form id="form-nueva-admision" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {cargandoOpciones ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Cargando pacientes, médicos y camas disponibles...
          </div>
        ) : (
          <>
            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <User size={14} className="text-blue-600" /> Paciente a internar
                </span>
                <select
                  className={CAMPO}
                  value={pacienteId}
                  onChange={(e) => setPacienteId(Number(e.target.value))}
                  required
                >
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Stethoscope size={14} className="text-blue-600" /> Médico responsable
                </span>
                <select
                  className={CAMPO}
                  value={medicoId}
                  onChange={(e) => setMedicoId(Number(e.target.value))}
                  required
                >
                  {medicos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} {m.detalle ? `(${m.detalle})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Bed size={14} className="text-blue-600" /> Habitación y Cama disponible
                </span>
                {camas.length === 0 ? (
                  <p className="mt-1 text-xs text-rose-600">
                    No hay camas libres en este momento en el hospital.
                  </p>
                ) : (
                  <select
                    className={CAMPO}
                    value={camaId}
                    onChange={(e) => setCamaId(Number(e.target.value))}
                    required
                  >
                    {camas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.habitacion} — Cama {c.numero}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="text-slate-700">Motivo del internamiento</span>
                <input
                  type="text"
                  className={CAMPO}
                  placeholder="Ej. Postoperatorio, neumonía, observación clínica..."
                  value={motivoIngreso}
                  onChange={(e) => setMotivoIngreso(e.target.value)}
                  required
                />
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="text-slate-700">Diagnóstico de ingreso / Observaciones</span>
                <textarea
                  className={`${CAMPO} h-20 resize-none`}
                  placeholder="Detalles clínicos o indicaciones al ingreso..."
                  value={diagnosticoIngreso}
                  onChange={(e) => setDiagnosticoIngreso(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </form>
    </ModalMarco>
  )
}
