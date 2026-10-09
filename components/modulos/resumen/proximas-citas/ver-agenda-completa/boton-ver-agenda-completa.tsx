export function BotonVerAgendaCompleta({ onVerAgenda }: { onVerAgenda: () => void }) {
  return (
    <button type="button" onClick={onVerAgenda} className="hidden text-xs font-semibold text-blue-600 sm:block">
      Ver agenda completa →
    </button>
  )
}
