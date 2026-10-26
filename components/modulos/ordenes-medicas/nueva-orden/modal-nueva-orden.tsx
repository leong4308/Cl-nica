'use client'

import { useEffect, useState } from 'react'
import { ModalMarco, CAMPO, ETIQUETA } from '../../compartidos/modal-marco'
import {
  cargarOpcionesOrdenes,
  crearOrdenMedica,
} from '@/lib/supabase/datos'
import { AlertCircle, ClipboardList, FlaskConical, Stethoscope } from 'lucide-react'

type PropsModalNuevaOrden = {
  onClose: () => void
  onSave?: (mensaje: string) => void
}

export function ModalNuevaOrden({ onClose, onSave }: PropsModalNuevaOrden) {
  const [internaciones, setInternaciones] = useState<
    { id: number; paciente: string; habitacionCama: string; medico: string; episodioId: number }[]
  >([])
  const [catalogoAnalisis, setCatalogoAnalisis] = useState<
    { id: number; nombre: string; requiereAyuno: boolean }[]
  >([])

  const [internacionId, setInternacionId] = useState<number | ''>('')
  const [tipoOrden, setTipoOrden] = useState<'analisis' | 'medicamento' | 'tratamiento' | 'procedimiento'>('analisis')
  const [analisisId, setAnalisisId] = useState<number | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [instrucciones, setInstrucciones] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    cargarOpcionesOrdenes().then((res) => {
      if (!vigente) return
      setInternaciones(res.internacionesActivas)
      setCatalogoAnalisis(res.catalogoAnalisis)
      if (res.internacionesActivas[0]) {
        setInternacionId(res.internacionesActivas[0].id)
      }
      if (res.catalogoAnalisis[0]) {
        setAnalisisId(res.catalogoAnalisis[0].id)
        setDescripcion(`Solicitud de análisis: ${res.catalogoAnalisis[0].nombre}`)
      }
      if (res.error) setError(res.error)
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [])

  const handleTipoChange = (nuevoTipo: 'analisis' | 'medicamento' | 'tratamiento' | 'procedimiento') => {
    setTipoOrden(nuevoTipo)
    if (nuevoTipo === 'analisis') {
      const actual = catalogoAnalisis.find((c) => c.id === Number(analisisId)) ?? catalogoAnalisis[0]
      if (actual) {
        setAnalisisId(actual.id)
        setDescripcion(`Solicitud de análisis: ${actual.nombre}`)
      }
    } else if (nuevoTipo === 'medicamento') {
      setDescripcion('Administración de medicamento')
    } else if (nuevoTipo === 'tratamiento') {
      setDescripcion('Plan de tratamiento médico')
    } else {
      setDescripcion('Procedimiento clínico programado')
    }
  }

  const handleAnalisisChange = (idNum: number) => {
    setAnalisisId(idNum)
    const encontrado = catalogoAnalisis.find((c) => c.id === idNum)
    if (encontrado) {
      setDescripcion(`Solicitud de análisis: ${encontrado.nombre}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!internacionId) {
      setError('Debes seleccionar un paciente internado para emitir la orden médica.')
      return
    }
    if (!descripcion.trim()) {
      setError('La descripción de la indicación u orden médica es obligatoria.')
      return
    }

    setGuardando(true)
    setError(null)

    const interSeleccionada = internaciones.find((i) => i.id === Number(internacionId))

    const res = await crearOrdenMedica({
      internacionId: Number(internacionId),
      episodioId: interSeleccionada?.episodioId,
      tipoOrden,
      descripcion: descripcion.trim(),
      instrucciones: instrucciones.trim() || undefined,
      analisisId: tipoOrden === 'analisis' && analisisId ? Number(analisisId) : undefined,
    })

    setGuardando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (onSave) onSave(`Orden médica prescrita para ${interSeleccionada?.paciente ?? 'el paciente'}`)
    onClose()
  }

  return (
    <ModalMarco
      title="Nueva orden médica"
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
            form="form-nueva-orden"
            disabled={guardando || cargando || internaciones.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Prescribiendo...' : 'Emitir orden médica'}
          </button>
        </div>
      }
    >
      <form id="form-nueva-orden" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {cargando ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Cargando internaciones activas y catálogo...
          </div>
        ) : internaciones.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
            No hay pacientes con internación activa en este momento. Las órdenes médicas clínicas están ligadas al seguimiento de pacientes hospitalizados.
          </div>
        ) : (
          <>
            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Stethoscope size={14} className="text-blue-600" /> Paciente hospitalizado
                </span>
                <select
                  className={CAMPO}
                  value={internacionId}
                  onChange={(e) => setInternacionId(Number(e.target.value))}
                  required
                >
                  {internaciones.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.paciente} · {item.habitacionCama} (Dr. {item.medico})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <ClipboardList size={14} className="text-blue-600" /> Tipo de orden médica
                </span>
                <select
                  className={CAMPO}
                  value={tipoOrden}
                  onChange={(e) => handleTipoChange(e.target.value as any)}
                >
                  <option value="analisis">Análisis / Laboratorio clínico</option>
                  <option value="medicamento">Medicamento / Farmacología</option>
                  <option value="tratamiento">Tratamiento / Cuidados</option>
                  <option value="procedimiento">Procedimiento / Intervención</option>
                </select>
              </label>
            </div>

            {tipoOrden === 'analisis' && (
              <div>
                <label className={ETIQUETA}>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <FlaskConical size={14} className="text-blue-600" /> Estudio de laboratorio
                  </span>
                  <select
                    className={CAMPO}
                    value={analisisId}
                    onChange={(e) => handleAnalisisChange(Number(e.target.value))}
                    required
                  >
                    {catalogoAnalisis.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre} {cat.requiereAyuno ? '(Requiere ayuno)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div>
              <label className={ETIQUETA}>
                <span className="text-slate-700">Descripción de la orden</span>
                <input
                  type="text"
                  className={CAMPO}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Biometría hemática completa, Suero salino 500ml IV cada 8h..."
                  required
                />
              </label>
            </div>

            <div>
              <label className={ETIQUETA}>
                <span className="text-slate-700">Instrucciones clínicas / Posología</span>
                <textarea
                  className={`${CAMPO} h-20 resize-none`}
                  placeholder="Instrucciones para enfermería o el área técnica..."
                  value={instrucciones}
                  onChange={(e) => setInstrucciones(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </form>
    </ModalMarco>
  )
}
