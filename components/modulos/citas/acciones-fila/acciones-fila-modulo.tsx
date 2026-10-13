'use client'

import { RowActions } from '../../compartidos/ui'
import type { CitaPanel } from '@/lib/supabase/datos'
import { precargarDetalleCita, registrarCitaRapida } from '@/lib/supabase/cache-detalle-cita'

type PropsAccionesFilaModulo = {
  id: string
  fila?: string[]
  modulo?: string
  esMedico?: boolean
  onAbrirModal: (titulo: string) => void
  onAccion?: (cita: CitaPanel, accion: 'detalle' | 'reagendar' | 'historial') => void
}

export function AccionesFilaModulo({
  id,
  fila,
  modulo,
  esMedico,
  onAbrirModal,
}: PropsAccionesFilaModulo) {
  if (modulo === 'Citas' && esMedico) {
    const numId = Number(id)

    const handleVerHistorial = () => {
      if (fila && fila.length >= 6 && !Number.isNaN(numId)) {
        registrarCitaRapida({
          id: numId,
          paciente: fila[1] ?? '',
          medico: fila[2] ?? '',
          motivo: fila[3] ?? '',
          estado: fila[9] || fila[4] || 'pendiente',
          inicio: fila[6] || new Date().toISOString(),
          fin: fila[7] || fila[6] || new Date().toISOString(),
          pacienteId: fila[8] ? Number(fila[8]) : undefined,
        })
      }
      onAbrirModal(`HistorialDetalle: ${id}`)
    }

    return (
      <RowActions
        onView={handleVerHistorial}
        onHoverView={!Number.isNaN(numId) ? () => void precargarDetalleCita(numId) : undefined}
      />
    )
  }

  return (
    <RowActions
      onView={() => onAbrirModal(`Detalle: ${id}`)}
      onEdit={esMedico ? undefined : () => onAbrirModal(`Editar: ${id}`)}
      onDelete={esMedico ? undefined : () => onAbrirModal(`Eliminar: ${id}`)}
    />
  )
}
