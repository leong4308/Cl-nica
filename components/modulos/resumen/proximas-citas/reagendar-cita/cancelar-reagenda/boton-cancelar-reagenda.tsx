/**
 * Botón "Cancelar" del pie de la vista "Reagendar cita".
 *
 * Vive en `proximas-citas/reagendar-cita/cancelar-reagenda/`: se pinta en
 * `modal-accion-cita.tsx` y solo cierra el modal.
 */
export function BotonCancelarReagenda({ onCancelar }: { onCancelar: () => void }) {
  return (
    <button type="button" onClick={onCancelar} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
      Cancelar
    </button>
  )
}
