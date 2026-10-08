/**
 * Botón "Ver agenda completa →" del panel de próximas citas.
 *
 * Vive en `proximas-citas/ver-agenda-completa/` porque es donde se pinta
 * (`proximas-citas.tsx`): navega al módulo Citas, no abre modal.
 */
export function BotonVerAgendaCompleta({ onVerAgenda }: { onVerAgenda: () => void }) {
  return (
    <button type="button" onClick={onVerAgenda} className="hidden text-xs font-semibold text-blue-600 sm:block">
      Ver agenda completa →
    </button>
  )
}
