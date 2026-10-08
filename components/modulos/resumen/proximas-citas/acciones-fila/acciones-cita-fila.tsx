'use client'

import { RowActions } from '../../../compartidos/ui'
import type { CitaPanel } from '@/lib/supabase/datos'
import { BotonConfirmarFila } from './confirmar-fila/boton-confirmar-fila'
import { BotonReagendarFila } from './reagendar-fila/boton-reagendar-fila'

/**
 * Botones "Confirmar" / "Reagendar" por fila del panel de próximas citas.
 *
 * Viven en `proximas-citas/acciones-fila/` porque es donde se pintan
 * (`proximas-citas.tsx`): solo salen en la pestaña "Reagendar" y abren el
 * modal de acciones con `onAccion(cita, 'detalle' | 'reagendar')`.
 * Incluyen los iconos de ver/editar (`RowActions`) y los dos botones de texto.
 */
export function AccionesCitaFila({
  cita, muestraAcciones, onAccion,
}: {
  cita: CitaPanel
  muestraAcciones: boolean
  onAccion: (cita: CitaPanel, accion: 'detalle' | 'reagendar') => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <RowActions
        onView={() => onAccion(cita, 'detalle')}
        {...(muestraAcciones ? { onEdit: () => onAccion(cita, 'reagendar') } : {})}
      />
      {muestraAcciones && (
        <>
          <BotonConfirmarFila onConfirmar={() => onAccion(cita, 'detalle')} />
          <BotonReagendarFila onReagendar={() => onAccion(cita, 'reagendar')} />
        </>
      )}
    </div>
  )
}
