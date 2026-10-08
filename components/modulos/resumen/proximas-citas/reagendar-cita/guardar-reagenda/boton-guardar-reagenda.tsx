/**
 * Botón "Guardar nueva fecha" del pie de la vista "Reagendar cita".
 *
 * Vive en `proximas-citas/reagendar-cita/guardar-reagenda/`: se pinta en
 * `modal-accion-cita.tsx`. Confirmar solo funciona si ya se eligió día y
 * hora (`deshabilitado`).
 */
export function BotonGuardarReagenda({
  deshabilitado, onGuardar,
}: {
  deshabilitado: boolean
  onGuardar: () => void
}) {
  return (
    <button
      type="button"
      onClick={onGuardar}
      disabled={deshabilitado}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      Guardar nueva fecha
    </button>
  )
}
