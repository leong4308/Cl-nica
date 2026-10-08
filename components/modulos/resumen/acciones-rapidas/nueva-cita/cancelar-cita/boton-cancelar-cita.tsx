/**
 * Botón "Cancelar" del pie del modal de "Nueva cita".
 *
 * Vive en `acciones-rapidas/nueva-cita/cancelar-cita/`: se pinta en
 * `modal-nueva-cita.tsx` y solo cierra el modal (no guarda nada).
 */
export function BotonCancelarCita({
  deshabilitado, onCancelar,
}: {
  deshabilitado: boolean
  onCancelar: () => void
}) {
  return (
    <button
      type="button"
      onClick={onCancelar}
      disabled={deshabilitado}
      className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      Cancelar
    </button>
  )
}
