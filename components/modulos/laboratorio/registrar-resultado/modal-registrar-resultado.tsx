'use client'

import { useEffect, useState } from 'react'
import { ModalMarco, CAMPO, ETIQUETA } from '../../compartidos/modal-marco'
import {
  cargarLaboratorio,
  registrarResultadoLaboratorio,
  marcarLaboratorioEnProceso,
} from '@/lib/supabase/datos'
import { AlertCircle, CheckCircle2, Clock, FileText, FlaskConical, Loader2 } from 'lucide-react'

type PropsModalRegistrarResultado = {
  solicitudIdInicial?: number
  onClose: () => void
  onSave?: (mensaje: string) => void
}

export function ModalRegistrarResultado({
  solicitudIdInicial,
  onClose,
  onSave,
}: PropsModalRegistrarResultado) {
  const [solicitudes, setSolicitudes] = useState<
    { id: number; codigo: string; orden: string; estudio: string; fecha: string; estado: string }[]
  >([])
  const [todasSolicitudes, setTodasSolicitudes] = useState<
    { id: number; codigo: string; orden: string; estudio: string; fecha: string; estado: string }[]
  >([])
  const [solicitudId, setSolicitudId] = useState<number | ''>(solicitudIdInicial ?? '')
  const [resultado, setResultado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [mostrarTodas, setMostrarTodas] = useState(false)

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [pasandoAProceso, setPasandoAProceso] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    cargarLaboratorio().then((res) => {
      if (!vigente) return
      const mapped = res.filas.map((f) => ({
        id: Number(f[5] || f[0].replace('LAB-', '')),
        codigo: f[0],
        orden: f[1],
        estudio: f[2],
        fecha: f[3],
        estado: (f[4] || 'solicitado').toLowerCase(),
      }))
      setTodasSolicitudes(mapped)

      // Filtrar pendientes: 'solicitado' o 'en proceso'
      const pendientes = mapped.filter((m) => m.estado !== 'completado')
      setSolicitudes(pendientes)

      if (solicitudIdInicial) {
        setSolicitudId(solicitudIdInicial)
      } else if (pendientes.length > 0) {
        setSolicitudId(pendientes[0].id)
      } else if (mapped.length > 0) {
        setSolicitudId(mapped[0].id)
      }

      if (res.error) setError(res.error)
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [solicitudIdInicial])

  const listaOpciones = mostrarTodas ? todasSolicitudes : solicitudes
  const solicitudSeleccionada = todasSolicitudes.find((s) => s.id === Number(solicitudId))

  const handleMarcarEnProceso = async () => {
    if (!solicitudId) return
    setPasandoAProceso(true)
    setError(null)
    const res = await marcarLaboratorioEnProceso(Number(solicitudId))
    setPasandoAProceso(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setTodasSolicitudes((prev) =>
      prev.map((s) => (s.id === Number(solicitudId) ? { ...s, estado: 'en proceso' } : s))
    )
    setSolicitudes((prev) =>
      prev.map((s) => (s.id === Number(solicitudId) ? { ...s, estado: 'en preceso' } : s))
    )
    if (onSave) onSave('Muestra ' + (solicitudSeleccionada?.codigo ?? '') + ' en proceso')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!solicitudId) {
      setError('Selecciona un analisis o muestra para capturar el resultado.')
      return
    }
    if (!resultado.trim()) {
      setError('El reporte o valores del resultado son obligatorios.')
      return
    }

    setGuardando(true)
    setError(null)

    const res = await registrarResultadoLaboratorio(
      Number(solicitudId),
      resultado.trim(),
      observaciones.trim() || undefined,
      'completado',
    )

    setGuardando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (onSave) onSave('Resultado de ' + (solicitudSeleccionada?.estudio ?? 'laboratorio') + ' completado y validado')
    onClose()
  }

  const renderBadge = (estado: string) => {
    if (estado === 'completado') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
          <CheckCircle2 size={12} className="text-emerald-600" /> Completado
        </span>
      )
    }
    if (estado === 'en proceso') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
          <Clock size={12} className="text-blue-600" /> En proceso
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200/60">
          <FlaskConical size={12} className="text-amber-600" /> Solicitado
        </span>
    )
  }

  return (
    <ModalMarco
      title="Registrar resultado de laboratorio"
      onClose={onClose}
      footer={
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div>
            {solicitudSeleccionada && solicitudSeleccionada.estado === 'solicitado' && (
              <button
                type="button"
                onClick={handleMarcarEnProceso}
                disabled={pasandoAProceso || guardando}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
              >
                {pasandoAProceso ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Clock size={13} />
                )}
                Pasar a 'En proceso'
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              disabled={guardando || pasandoAProceso}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-registrar-resultado"
              disabled={guardando || cargando || !solicitudId}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Completar y validar resultado</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <form id="form-registrar-resultado" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200/70">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {cargando ? (
          <div className="flex flex-col items-center justify-center py-8 text-xs text-slate-400 gap-2">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <span>Cargando solicitudes de laboratorio...</span>
          </div>
        ) : listaOpciones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-2">
            <p className="font-medium text-slate-700">No hay analisis pendientes por capturar</p>
            <p className="text-slate-400">Todos los analisis solicitados ya se encuentran en estado 'Completado'.</p>
            <button
              type="button"
              onClick={() => setMostrarTodas(true)}
              className="mt-2 inline-block font-semibold text-blue-600 hover:underline"
            >
              Ver tambien analisis completados
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <FlaskConical size={14} className="text-blue-600" /> Solicitud / Muestra pendiente
                </span>
                <button
                  type="button"
                  onClick={() => setMostrarTodas(!mostrarTodas)}
                  className="text-[11px] font-medium text-blue-600 hover:underline"
                >
                  {mostrarTodas ? 'Mostrar solo pendientes' : 'Ver todas (incluyendo completadas)'}
                </button>
              </div>

              <select
                className={CAMPO}
                value={solicitudId}
                onChange={(e) => setSolicitudId(Number(e.target.value))}
                required
              >
                {listaOpciones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.codigo} - {s.estudio} ({s.orden}) [{s.estado.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            {solicitudSeleccionada && (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-xs">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{solicitudSeleccionada.estudio}</p>
                  <p className="mt-0.5 text-slate-500">
                    Folio: <span className="font-mono font-medium text-slate-700">{solicitudSeleccionada.codigo}</span> | Orden: <span className="font-medium text-slate-700">{solicitudSeleccionada.orden}</span> | Fecha: {solicitudSeleccionada.fecha}
                  </p>
                </div>
                <div className="shrink-0">
                  {renderBadge(solicitudSeleccionada.estado)}
                </div>
              </div>
            )}

            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <FileText size={14} className="text-blue-600" /> Valores / Interpretacion del resultado clinico
                </span>
                <textarea
                  className={(CAMPO + ' h-28 resize-none font-mono text-xs')}
                  placeholder="Ej. Glucosa en ayuno: 92 mg/dL (Normal: 70-100)&#x0A;Hemoglobina: 14.5 g/dL&#x0A;Plaquetas: 250,000 /uL&#x0A;Conclusion: Parametros dentro de rangos normales."
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  required
                />
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="text-slate-700">Observaciones tecnicas adicionales (opcional)</span>
                <input
                  type="text"
                  className={CAMPO}
                  placeholder="Ej. Muestra sin hemolisis, procesada en analizador automatizado..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </form>
    </ModalMarco>
  )
}
