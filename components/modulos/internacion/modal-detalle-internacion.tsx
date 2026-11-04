'use client'

import { useState } from 'react'
import { ModalMarco, CAMPO, ETIQUETA } from '../compartidos/modal-marco'
import { darAltaPaciente } from '@/lib/supabase/datos'
import { AlertCircle, Bed, CheckCircle2, Loader2, User, Calendar, Stethoscope } from 'lucide-react'

type PropsModalDetalleInternacion = {
  internacion: {
    id: number
    habitacionCama: string
    paciente: string
    ingreso: string
    medico: string
    estado: string
  }
  onClose: () => void
  onSave?: (mensaje: string) => void
}

export function ModalDetalleInternacion({
  internacion,
  onClose,
  onSave,
}: PropsModalDetalleInternacion) {
  const [notaAlta, setNotaAlta] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const estaActiva = internacion.estado.toLowerCase().includes('ocupad') || internacion.estado.toLowerCase() === 'activa'

  const handleDarAlta = async () => {
    setProcesando(true)
    setError(null)
    const res = await darAltaPaciente(internacion.id, notaAlta)
    setProcesando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (onSave) onSave('Paciente dado de alta y cama liberada con exito')
    onClose()
  }

  return (
    <ModalMarco
      title="Detalle de Hospitalizacion / Alta"
      onClose={onClose}
      footer={
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cerrar
          </button>

          {estaActiva ? (
            <button
              type="button"
              onClick={handleDarAlta}
              disabled={procesando}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {procesando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Liberando cama...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Dar de alta y liberar cama</span>
                </>
              )}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              <CheckCircle2 size={13} className="text-slate-500" /> Paciente ya dado de alta
            </span>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200/70">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-4">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ubicacion hospitalaria</span>
            <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Bed size={15} className="text-blue-600" /> {internacion.habitacionCama}
            </p>
          </div>
          <div>
            {estaActiva ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/60">
                Cama Ocupada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                Alta (Liberada)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-slate-100 p-3 bg-white shadow-xs">
            <span className="text-slate-400 block mb-0.5">Paciente internado</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <User size={13} className="text-blue-600" /> {internacion.paciente}
            </span>
          </div>
          <div className="rounded-lg border border-slate-100 p-3 bg-white shadow-xs">
            <span className="text-slate-400 block mb-0.5">Medico responsable</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <Stethoscope size={13} className="text-blue-600" /> {internacion.medico}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 text-xs">
          <span className="text-slate-400 block mb-0.5">Fecha de ingreso</span>
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <Calendar size={13} className="text-slate-500" /> {internacion.ingreso}
          </span>
        </div>

        {estaActiva && (
          <div>
            <label className={ETIQUETA}>
              <span className="text-slate-700">Notas de egreso / evolucion clinica (opcional)</span>
              <textarea
                className={(CAMPO + ' h-20 resize-none text-xs')}
                placeholder="Ej. Paciente cumple criterios de egreso clinico. Se indica tratamiento ambulatorio y seguimiento..."
                value={notaAlta}
                onChange={(e) => setNotaAlta(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 p-3 text-xs text-emerald-800 space-y-1">
          <p className="font-semibold">Gestion automatizada de camas:</p>
          <p className="text-[11px] text-emerald-700">
            Al confirmar el alta, la cama queda automaticamente libre y disponible para nuevas admisiones, y se actualizan las metricas de ocupacion en tiempo real.
          </p>
        </div>
      </div>
    </ModalMarco>
  )
}
