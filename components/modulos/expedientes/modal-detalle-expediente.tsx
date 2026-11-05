'use client'

import { useState } from 'react'
import { ModalMarco, CAMPO, ETIQUETA } from '../compartidos/modal-marco'
import { guardarExpediente } from '@/lib/supabase/datos'
import { AlertCircle, Calendar, FileText, Loader2, Pill, Stethoscope, User } from 'lucide-react'

export type ExpedienteEditable = {
  id: number
  paciente: string
  motivo: string
  diagnostico: string
  medico: string
  actualizado: string
  citaId?: number
  receta?: string
  notas?: string
}

type PropsModalDetalleExpediente = {
  expediente: ExpedienteEditable
  modo?: 'ver' | 'editar'
  onClose: () => void
  onSave?: (mensaje: string) => void
}

export function ModalDetalleExpediente({
  expediente,
  modo: modoInicial = 'ver',
  onClose,
  onSave,
}: PropsModalDetalleExpediente) {
  const [modo, setModo] = useState<'ver' | 'editar'>(modoInicial)
  const [diagnostico, setDiagnostico] = useState(expediente.diagnostico || '')
  const [receta, setReceta] = useState(expediente.receta || '')
  const [notas, setNotas] = useState(expediente.notas || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!diagnostico.trim()) {
      setError('El diagnóstico es obligatorio.')
      return
    }

    setGuardando(true)
    setError(null)

    const res = await guardarExpediente({
      citaId: expediente.citaId ?? 0,
      diagnostico: diagnostico.trim(),
      receta: receta.trim(),
      notas: notas.trim(),
      id: expediente.id,
    } as any)

    setGuardando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (onSave) onSave(`Expediente clínico de ${expediente.paciente} actualizado correctamente`)
    onClose()
  }

  return (
    <ModalMarco
      title={modo === 'editar' ? 'Editar Expediente Clínico' : 'Detalle de Expediente Clínico'}
      onClose={onClose}
      ancho="max-w-xl"
      footer={
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {modo === 'ver' ? 'Cerrar' : 'Cancelar'}
          </button>

          {modo === 'ver' ? (
            <button
              type="button"
              onClick={() => setModo('editar')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Editar expediente
            </button>
          ) : (
            <button
              type="submit"
              form="form-editar-expediente"
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {guardando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Guardando cambios...</span>
                </>
              ) : (
                <span>Guardar cambios</span>
              )}
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Resumen del paciente y cita */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-slate-700 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
              <User size={15} className="text-blue-600" />
              {expediente.paciente}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              ID #{expediente.id}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600 pt-1 border-t border-blue-100/60">
            <p className="flex items-center gap-1">
              <Stethoscope size={12} className="text-blue-500 shrink-0" />
              <span>Médico: <strong className="text-slate-800">{expediente.medico}</strong></span>
            </p>
            <p className="flex items-center gap-1">
              <Calendar size={12} className="text-blue-500 shrink-0" />
              <span>Fecha: <strong className="text-slate-800">{expediente.actualizado}</strong></span>
            </p>
            <p className="sm:col-span-2 text-slate-500">
              Motivo: <span className="font-medium text-slate-700">{expediente.motivo}</span>
            </p>
          </div>
        </div>

        {modo === 'ver' ? (
          <div className="space-y-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                <Stethoscope size={14} className="text-blue-600" /> Diagnóstico clínico
              </p>
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-800 border border-slate-100 min-h-[48px] whitespace-pre-wrap">
                {diagnostico || <span className="italic text-slate-400">Sin diagnóstico registrado</span>}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                <Pill size={14} className="text-emerald-600" /> Tratamiento / Receta médica
              </p>
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-800 border border-slate-100 font-mono min-h-[48px] whitespace-pre-wrap">
                {receta || <span className="italic text-slate-400 font-sans">Sin receta médica asignada</span>}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                <FileText size={14} className="text-slate-600" /> Notas y evolución médica
              </p>
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 border border-slate-100 min-h-[40px] whitespace-pre-wrap">
                {notas || <span className="italic text-slate-400">Sin observaciones adicionales</span>}
              </div>
            </div>
          </div>
        ) : (
          <form id="form-editar-expediente" onSubmit={handleGuardar} className="space-y-3">
            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Stethoscope size={14} className="text-blue-600" /> Diagnóstico clínico
                </span>
                <textarea
                  className={`${CAMPO} h-24 resize-none`}
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
          </form>
        )}
      </div>
    </ModalMarco>
  )
}

