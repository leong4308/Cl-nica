'use client'

import { useEffect, useState } from 'react'
import { FlaskConical, Clock, CheckCircle2 } from 'lucide-react'
import { cargarLaboratorio } from '@/lib/supabase/datos'
import { ModalMarco } from '../../../compartidos/modal-marco'

type PropsModalResultadosPendientes = {
  onClose: () => void
}

type ResultadoLab = {
  codigo: string
  paciente: string
  prueba: string
  fecha: string
  estado: string
}

export function ModalResultadosPendientes({ onClose }: PropsModalResultadosPendientes) {
  const [resultados, setResultados] = useState<ResultadoLab[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    cargarLaboratorio().then((res) => {
      if (!vigente) return
      if (res.error) {
        setError(res.error)
      } else {
        setResultados(
          res.filas.map((fila) => ({
            codigo: fila[0] ?? '—',
            paciente: fila[1] ?? '—',
            prueba: fila[2] ?? '—',
            fecha: fila[3] ?? '—',
            estado: fila[4] ?? 'Pendiente',
          }))
        )
      }
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [])

  return (
    <ModalMarco
      title="Resultados y análisis de laboratorio"
      onClose={onClose}
      footer={
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Cerrar
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
      <div className="space-y-3">
        {cargando ? (
          <p className="py-8 text-center text-xs text-slate-400">Cargando resultados de laboratorio...</p>
        ) : resultados.length === 0 ? (
          <div className="py-8 text-center">
            <FlaskConical className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-xs font-medium text-slate-500">No hay análisis pendientes por ahora.</p>
          </div>
        ) : (
          resultados.map((item, idx) => {
            const esPendiente = item.estado.toLowerCase().includes('proceso') || item.estado.toLowerCase().includes('pend')
            return (
              <div
                key={`${item.codigo}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <FlaskConical size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{item.prueba}</p>
                    <p className="text-[11px] text-slate-400">{item.codigo} · {item.fecha}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    esPendiente
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {esPendiente ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                  {item.estado}
                </span>
              </div>
            )
          })
        )}
      </div>
    </ModalMarco>
  )
}
