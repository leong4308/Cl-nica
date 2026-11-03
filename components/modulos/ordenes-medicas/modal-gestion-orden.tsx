'use client'

import { useState } from 'react'
import { ModalMarco } from '../compartidos/modal-marco'
import { actualizarEstadoOrdenMedica } from '@/lib/supabase/datos'
import { AlertCircle, CheckCircle2, Clock, XCircle, Loader2, ClipboardList, Stethoscope } from 'lucide-react'

type PropsModalGestionOrden = {
  orden: {
    id: number
    codigo: string
    episodio: string
    medico: string
    descripcion: string
    estado: string
  }
  onClose: () => void
  onSave?: (mensaje: string) => void
}

export function ModalGestionOrden({ orden, onClose, onSave }: PropsModalGestionOrden) {
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCambiarEstado = async (nuevoEstado: 'prescrita' | 'en_proceso' | 'realizada' | 'cancelada') => {
    setActualizando(true)
    setError(null)
    const res = await actualizarEstadoOrdenMedica(orden.id, nuevoEstado)
    setActualizando(false)
    if (res.error) {
      setError(res.error)
      return
    }
    const label = nuevoEstado === 'realizada' ? 'Completada' : nuevoEstado === 'en_proceso' ? 'En proceso' : nuevoEstado === 'cancelada' ? 'Cancelada' : 'Pendiente'
    if (onSave) onSave('Orden ' + orden.codigo + ' actualizada a ' + label)
    onClose()
  }

  const estadoNorm = (orden.estado || '').toLowerCase()

  const badgeEstado = (estado: string) => {
    if (estado.includes('complet') || estado.includes('realiz')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
          <CheckCircle2 size={13} className="text-emerald-600" /> Completada
        </span>
      )
    }
    if (estado.includes('proceso')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/60">
          <Clock size={13} className="text-blue-600" /> En proceso
        </span>
      )
    }
    if (estado.includes('cancel')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/60">
          <XCircle size={13} className="text-rose-600" /> Cancelada
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/60">
        <ClipboardList size={13} className="text-amber-600" /> Pendiente (Prescrita)
      </span>
    )
  }

  return (
    <ModalMarco
      title={'Gestion de Orden ' + orden.codigo}
      onClose={onClose}
      footer={
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div>
            {!estadoNorm.includes('cancel') && !estadoNorm.includes('complet') && (
              <button
                type="button"
                onClick={() => handleCambiarEstado('cancelada')}
                disabled={actualizando}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                Cancelar orden
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={actualizando}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cerrar
            </button>
            {(!estadoNorm.includes('proceso') && !estadoNorm.includes('complet') && !estadoNorm.includes('cancel')) && (
              <button
                type="button"
                onClick={() => handleCambiarEstado('en_proceso')}
                disabled={actualizando}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                {actualizando ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
                Pasar a 'En proceso'
              </button>
            )}
            {!estadoNorm.includes('complet') && !estadoNorm.includes('cancel') && (
              <button
                type="button"
                onClick={() => handleCambiarEstado('realizada')}
                disabled={actualizando}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {actualizando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Completar indicacion
              </button>
            )}
          </div>
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
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Codigo de Orden</span>
            <p className="font-mono text-base font-bold text-slate-800">{orden.codigo}</p>
          </div>
          <div>{badgeEstado(orden.estado)}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-slate-100 p-3 bg-white shadow-xs">
            <span className="text-slate-400 block mb-0.5">Episodio clinico</span>
            <span className="font-semibold text-slate-700">{orden.episodio}</span>
          </div>
          <div className="rounded-lg border border-slate-100 p-3 bg-white shadow-xs">
            <span className="text-slate-400 block mb-0.5">Medico solicitante</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Stethoscope size={13} className="text-blue-600" /> {orden.medico}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
          <span className="text-xs font-semibold text-slate-700 block mb-1.5">Descripcion de la indicacion medica</span>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-100">
            {orden.descripcion}
          </p>
        </div>

        <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Ciclo de atencion clinica:</p>
          <p className="text-[11px] text-blue-700">
            Marca <strong>En proceso</strong> cuando el personal inicie la preparacion, o <strong>Completar indicacion</strong> una vez administrado el medicamento o realizado el estudio.
          </p>
        </div>
      </div>
    </ModalMarco>
  )
}
