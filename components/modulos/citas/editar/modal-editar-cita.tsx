import { useEffect, useState } from 'react'
import { cargarMedicosAgenda, obtenerCita, actualizarCita, type CitaDetalle } from '@/lib/supabase/datos'
import { ModalMarco, CAMPO } from '../../compartidos/modal-marco'

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

  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [medicoId, setMedicoId] = useState<number | ''>('')
  const [duracionConsulta, setDuracionConsulta] = useState(20)

  const [citaActual, setCitaActual] = useState<CitaDetalle | null>(null)
  const [medicos, setMedicos] = useState<
    { id: number; nombre: string; especialidad: string; duracionConsulta: number }[]
  >([])
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  useEffect(() => {
    let cancelada = false

    async function cargarCita() {
      setCargando(true)
      setError(null)
      setErrorCarga(null)
      const { cita, error } = await obtenerCita(citaId)
      if (cancelada) return
      if (error) {
        setError(error)
        setCitaActual(null)
        setMedicoId('')
        return
      }
      if (!cita) return
      setCitaActual(cita)
      setFecha(fechaIso(cita.inicio))
      setHora(horaIso(cita.inicio))
      setMotivo(cita.motivo ?? '')
      setMedicoId(cita.medicoId)
      setDuracionConsulta(20)
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

  function fechaIso(iso: string): string {
    return iso.split('T')[0]
  }

  function horaIso(iso: string): string {
    const [, hora, minutos] = iso.split('T')[1].split(':').map(Number)
    return `${String(hora).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
  }

  async function guardar() {
    if (!fecha || !hora || medicoId === '' || !citaActual) return
    setGuardando(true)
    setError(null)
    const { error } = await actualizarCita(
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
    if (error) {
      setError(error)
      return
    }
    onClose()
  }

  return (
    <ModalMarco
      title="Editar cita"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !citaActual}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      }
      aviso={error ? <p className="text-sm text-red-600">{error}</p> : null}
    >
      {cargando ? (
        <p className="text-sm text-slate-400">Cargando cita...</p>
      ) : (
        <div className="grid gap-4">
          <label className="text-sm font-medium block">Fecha
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className={CAMPO}
              required
            />
          </label>
          <label className="text-sm font-medium block">Hora
            <input
              type="time"
              value={hora}
              onChange={(event) => setHora(event.target.value)}
              className={CAMPO}
              required
            />
          </label>
          <label className="text-sm font-medium block">Médico
            <select
              value={medicoId}
              onChange={(event) => {
                const id = event.target.value === '' ? '' : Number(event.target.value)
                const medico = medicos.find((medico) => medico.id === id)
                setMedicoId(id)
                setDuracionConsulta(medico?.duracionConsulta ?? 20)
              }}
              className={CAMPO}
            >
              <option value="">Seleccione médico</option>
              {medicos.map((medico) => (
                <option key={medico.id} value={medico.id}>
                  {medico.nombre} · {medico.especialidad}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium block">
            Motivo
            <textarea
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              className={CAMPO}
              rows={3}
              placeholder="Motivo de la consulta"
            />
          </label>
        </div>
      )}
    </ModalMarco>
  )
}