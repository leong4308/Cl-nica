'use client'

import { RowActions } from '../../../compartidos/ui'
import type { CitaPanel } from '@/lib/supabase/datos'
import { BotonConfirmarFila } from './confirmar-fila/boton-confirmar-fila'
import { BotonReagendarFila } from './reagendar-fila/boton-reagendar-fila'

export function AccionesCitaFila({
  cita, muestraConfirmar, muestraReagendar, onAccion,
}: {
  cita: CitaPanel
  muestraConfirmar: boolean
  muestraReagendar: boolean
  onAccion: (cita: CitaPanel, accion: 'detalle' | 'reagendar' | 'historial') => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <RowActions onView={() => onAccion(cita, 'detalle')} />
      {muestraConfirmar && (
        <BotonConfirmarFila onConfirmar={() => onAccion(cita, 'historial')} />
      )}
      {muestraReagendar && (
        <BotonReagendarFila onReagendar={() => onAccion(cita, 'reagendar')} />
      )}
    </div>
  )
}
