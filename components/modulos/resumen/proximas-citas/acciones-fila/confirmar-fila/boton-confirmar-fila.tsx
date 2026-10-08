/**
 * Botón "Confirmar" por fila del panel (pestaña Reagendar).
 *
 * Vive en `proximas-citas/acciones-fila/confirmar-fila/` junto a
 * `AccionesCitaFila`, que lo pinta solo en la pestaña "Reagendar".
 */
export function BotonConfirmarFila({ onConfirmar }: { onConfirmar: () => void }) {
  return (
    <button
      type="button"
      onClick={onConfirmar}
      className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
    >
      Confirmar
    </button>
  )
}
