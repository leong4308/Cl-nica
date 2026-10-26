'use client'

import { useEffect, useState } from 'react'
import { ModalMarco, CAMPO, ETIQUETA } from '../../compartidos/modal-marco'
import {
  cargarLaboratorio,
  registrarResultadoLaboratorio,
} from '@/lib/supabase/datos'
import { AlertCircle, CheckCircle, FileText, FlaskConical } from 'lucide-react'

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
  const [solicitudId, setSolicitudId] = useState<number | ''>(solicitudIdInicial ?? '')
  const [resultado, setResultado] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
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
        estado: f[4],
      }))
      setSolicitudes(mapped)

      if (solicitudIdInicial) {
        setSolicitudId(solicitudIdInicial)
      } else if (mapped[0]) {
        // Preferir el primero que esté solicitado o pendiente
        const pendiente = mapped.find((m) => m.estado !== 'completado') ?? mapped[0]
        setSolicitudId(pendiente.id)
      }

      if (res.error) setError(res.error)
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [solicitudIdInicial])

  const solicitudSeleccionada = solicitudes.find((s) => s.id === Number(solicitudId))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!solicitudId) {
      setError('Selecciona un análisis o muestra para capturar el resultado.')
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
    )

    setGuardando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (onSave) onSave(`Resultado de ${solicitudSeleccionada?.estudio ?? 'laboratorio'} registrado`)
    onClose()
  }

  return (
    <ModalMarco
      title="Registrar resultado de laboratorio"
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
            form="form-registrar-resultado"
            disabled={guardando || cargando || solicitudes.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <CheckCircle size={14} />
            {guardando ? 'Guardando resultado...' : 'Guardar y validar resultado'}
          </button>
        </div>
      }
    >
      <form id="form-registrar-resultado" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {cargando ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Cargando solicitudes de laboratorio...
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
            No hay solicitudes de análisis registradas en el laboratorio. Puedes generar una desde Órdenes Médicas.
          </div>
        ) : (
          <>
            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <FlaskConical size={14} className="text-blue-600" /> Solicitud / Muestra
                </span>
                <select
                  className={CAMPO}
                  value={solicitudId}
                  onChange={(e) => setSolicitudId(Number(e.target.value))}
                  required
                >
                  {solicitudes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.codigo} · {s.estudio} ({s.orden}) [{s.estado}]
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {solicitudSeleccionada && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">{solicitudSeleccionada.estudio}</p>
                <p className="mt-0.5 text-slate-500">
                  Folio: {solicitudSeleccionada.codigo} · Orden asociada: {solicitudSeleccionada.orden} · Fecha: {solicitudSeleccionada.fecha}
                </p>
              </div>
            )}

            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <FileText size={14} className="text-blue-600" /> Valores / Interpretación del resultado
                </span>
                <textarea
                  className={`${CAMPO} h-28 resize-none font-mono text-xs`}
                  placeholder="Ej. Glucosa en ayuno: 92 mg/dL (Normal: 70-100)&#10;Hemoglobina: 14.5 g/dL&#10;Plaquetas: 250,000 /uL&#10;Conclusión: Parámetros dentro de rangos normales."
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  required
                />
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="text-slate-700">Observaciones técnicas adicionales (opcional)</span>
                <input
                  type="text"
                  className={CAMPO}
                  placeholder="Ej. Muestra sin hemólisis, procesada en analizador automatizado..."
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
