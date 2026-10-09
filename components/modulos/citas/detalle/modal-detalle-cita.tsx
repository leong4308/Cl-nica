import { useEffect, useState } from 'react'
import { ModalMarco } from '../../compartidos/modal-marco'
import { obtenerCita, type CitaDetalle } from '@/lib/supabase/datos'

export function ModalDetalleCita({
  citaId,
  onClose,
}: {
  citaId: number
  onClose: () => void
}) {
  const [cita, setCita] = useState<CitaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelada = false

    obtenerCita(citaId).then(({ cita, error }) => {
      if (cancelada) return
      setCargando(false)
      if (error) {
        setError(error)
        setCita(null)
        return
      }
      setCita(cita)
    })

    return () => {
      cancelada = true
    }
  }, [citaId])

  if (cargando) {
    return (
      <ModalMarco title="Detalle de la cita" onClose={onClose}>
        <p className="text-sm text-slate-400">Cargando cita...</p>
      </ModalMarco>
    )
  }

  if (error) {
    return (
      <ModalMarco title="Detalle de la cita" onClose={onClose}>
        <p className="text-sm text-red-600">{error}</p>
      </ModalMarco>
    )
  }

  if (!cita) return null

  const fecha = new Date(cita.inicio).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const hora = new Date(cita.inicio).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <ModalMarco title="Detalle de la cita" onClose={onClose}>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Hora</dt>
          <dd className="text-slate-900">{hora}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Fecha</dt>
          <dd className="text-slate-900">{fecha}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Paciente</dt>
          <dd className="text-slate-900">{cita.paciente}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Médico</dt>
          <dd className="text-slate-900">{cita.medico}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Motivo</dt>
          <dd className="text-slate-900">{cita.motivo ?? 'Sin motivo'}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-slate-100 pt-2">
          <dt className="text-sm font-semibold text-slate-700">Estado</dt>
          <dd className="text-sm font-semibold text-slate-900">{cita.estado}</dd>
        </div>
      </dl>
    </ModalMarco>
  )
}