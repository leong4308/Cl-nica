/**
 * Botón "Reagendar" por fila del panel.
 *
 * Vive en `proximas-citas/acciones-fila/reagendar-fila/`: abre el modal de
 * acciones, que vive en `proximas-citas/modal-accion-cita.tsx`.
 */
export function BotonReagendarFila({ onReagendar }: { onReagendar: () => void }) {
  return (
    <button
      type="button"
      onClick={onReagendar}
      className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
    >
      Reagendar
    </button>
  )
}
