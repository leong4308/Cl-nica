'use client'

import { useEffect, useState } from 'react'
import { ModalMarco, CAMPO, ETIQUETA } from '../../compartidos/modal-marco'
import {
  cargarCitasParaExpediente,
  guardarExpediente,
} from '@/lib/supabase/datos'
import { AlertCircle, Calendar, FileText, Pill, Stethoscope } from 'lucide-react'

type PropsModalNuevoExpediente = {
  citaIdInicial?: number
  onClose: () => void
  onSave?: (mensaje: string) => void
}

export function ModalNuevoExpediente({
  citaIdInicial,
  onClose,
  onSave,
}: PropsModalNuevoExpediente) {
  const [citas, setCitas] = useState<
    { id: number; paciente: string; medico: string; fecha: string; motivo: string }[]
  >([])
  const [citaId, setCitaId] = useState<number | ''>(citaIdInicial ?? '')
  const [diagnostico, setDiagnostico] = useState('')
  const [receta, setReceta] = useState('')
  const [notas, setNotas] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    cargarCitasParaExpediente().then((res) => {
      if (!vigente) return
      setCitas(res.citas)
      if (citaIdInicial) {
        setCitaId(citaIdInicial)
      } else if (res.citas[0]) {
        setCitaId(res.citas[0].id)
      }
      if (res.error) setError(res.error)
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [citaIdInicial])

  const citaSeleccionada = citas.find((c) => c.id === Number(citaId))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!citaId) {
      setError('Selecciona la consulta/cita a la que pertenece este expediente.')
      return
    }
    if (!diagnostico.trim()) {
      setError('El diagnóstico clínico es obligatorio.')
      return
    }

    setGuardando(true)
    setError(null)

    const res = await guardarExpediente({
      citaId: Number(citaId),
      diagnostico: diagnostico.trim(),
      receta: receta.trim(),
      notas: notas.trim(),
    })

    setGuardando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (onSave) onSave(`Expediente médico de ${citaSeleccionada?.paciente ?? 'consulta'} guardado correctamente`)
    onClose()
  }

  return (
    <ModalMarco
      title="Nuevo expediente clínico"
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
            form="form-nuevo-expediente"
            disabled={guardando || cargando || citas.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar expediente'}
          </button>
        </div>
      }
    >
      <form id="form-nuevo-expediente" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {cargando ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Cargando citas y consultas...
          </div>
        ) : citas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
            No hay citas registradas en la clínica para vincular expedientes. Primero agenda o atiende una consulta.
          </div>
        ) : (
          <>
            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Calendar size={14} className="text-blue-600" /> Consulta / Cita del paciente
                </span>
                <select
                  className={CAMPO}
                  value={citaId}
                  onChange={(e) => setCitaId(Number(e.target.value))}
                  required
                >
                  {citas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.paciente} · {c.fecha} ({c.motivo}) — Dr. {c.medico}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {citaSeleccionada && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">{citaSeleccionada.paciente}</p>
                <p className="mt-0.5 text-slate-500">
                  Médico tratante: Dr. {citaSeleccionada.medico} · Fecha: {citaSeleccionada.fecha} · Motivo: {citaSeleccionada.motivo}
                </p>
              </div>
            )}

            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Stethoscope size={14} className="text-blue-600" /> Diagnóstico médico
                </span>
                <textarea
                  className={`${CAMPO} h-20 resize-none`}
                  placeholder="Diagnóstico clínico, código CIE o impresión diagnóstica..."
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  required
                />
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Pill size={14} className="text-blue-600" /> Tratamiento farmacológico / Receta
                </span>
                <textarea
                  className={`${CAMPO} h-20 resize-none font-mono text-xs`}
                  placeholder="Ej. Paracetamol 500mg vía oral cada 8 horas por 3 días..."
                  value={receta}
                  onChange={(e) => setReceta(e.target.value)}
                />
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <FileText size={14} className="text-blue-600" /> Notas clínicas y evolución
                </span>
                <textarea
                  className={`${CAMPO} h-16 resize-none`}
                  placeholder="Observaciones adicionales, antecedentes o pronóstico..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </form>
    </ModalMarco>
  )
}
