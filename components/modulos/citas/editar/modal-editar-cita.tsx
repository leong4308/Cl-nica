import { useEffect, useState } from 'react'
import { Calendar, Clock, Stethoscope, FileText, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'
import { cargarMedicosAgenda, obtenerCita, actualizarCita, type CitaDetalle } from '@/lib/supabase/datos'

export function ModalEditarCita({
  citaId,
  onClose,
}: {
  citaId: number
  onClose: () => void
}) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [medicoId, setMedicoId] = useState<number | ''>('')
  const [duracionConsulta, setDuracionConsulta] = useState(20)

  const [citaActual, setCitaActual] = useState<CitaDetalle | null>(null)
  const [medicos, setMedicos] = useState<
    { id: number; nombre: string; especialidad: string; duracionConsulta: number }[]
  >([])

  useEffect(() => {
    let cancelada = false

    async function cargarCita() {
      setCargando(true)
      setError(null)
      const { cita, error } = await obtenerCita(citaId)
      if (cancelada) return
      if (error) {
        setError(error)
        setCitaActual(null)
        setCargando(false)
        return
      }
      if (!cita) {
        setError('No se encontró la cita especificada.')
        setCargando(false)
        return
      }
      setCitaActual(cita)
      setFecha(cita.inicio.split('T')[0])
      try {
        const timePart = cita.inicio.split('T')[1]
        const [h, m] = timePart.split(':').map(Number)
        setHora(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'))
      } catch {
        setHora('09:00')
      }
      setMotivo(cita.motivo ?? '')
      setMedicoId(cita.medicoId)
      setCargando(false)
    }

    cargarCita()
    return () => {
      cancelada = true
    }
  }, [citaId])

  useEffect(() => {
    cargarMedicosAgenda().then((resultado) => {
      if (!resultado.error) setMedicos(resultado.filas)
    })
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!fecha || !hora || medicoId === '' || !citaActual) return
    setGuardando(true)
    setError(null)

    const { error: errUpdate } = await actualizarCita(
      {
        pacienteId: citaActual.pacienteId,
        medicoId: Number(medicoId),
        clinicaId: citaActual.clinicaId,
        fecha,
        hora,
        motivo: motivo.trim(),
        duracionConsulta,
      },
      citaActual.id,
    )

    setGuardando(false)
    if (errUpdate) {
      setError(errUpdate)
      return
    }

    setExito(true)
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    onClose()
  }

  return (
    <div
      className=" fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 transition-all"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 transition-all"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-sm">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Editar Cita Médica</h3>
              <p className="text-xs text-slate-500">Modifica la fecha, horario, médico o motivo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback: Banner de Error */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs font-medium text-rose-700 shadow-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Feedback: Banner de Éxito */}
        {exito && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs font-medium text-emerald-700 shadow-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>¡Cita actualizada con éxito! Sincronizando cambios...</span>
          </div>
        )}

        {/* Contenido / Formulario */}
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-xs font-medium text-slate-500">Cargando información de la cita...</p>
          </div>
        ) : (
          <form onSubmit={guardar} className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Fecha programada
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Hora
                </label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                Médico especialista
              </label>
              <select
                value={medicoId}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value)
                  const m = medicos.find((item) => item.id === val)
                  setMedicoId(val)
                  setDuracionConsulta(m?.duracionConsulta ?? 20)
                }}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all shadow-sm"
              >
                <option value="">Selecciona un médico</option>
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} · {m.especialidad}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Motivo de la consulta
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Describe el motivo de la cita médica..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all shadow-sm"
              />
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando || !citaActual}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
              >
                {guardando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
