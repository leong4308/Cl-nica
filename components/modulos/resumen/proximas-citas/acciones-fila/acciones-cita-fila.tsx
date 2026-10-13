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
        cita.solicitaReagenda ? (
          <button
            type="button"
            onClick={() => onAccion(cita, 'reagendar')}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
            title="Solicitud enviada a recepción para asignar fecha próxima"
          >
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            Enviado a recepción
          </button>
        ) : (
          <BotonReagendarFila onReagendar={() => onAccion(cita, 'reagendar')} />
        )
      )}
    </div>
  )
}
