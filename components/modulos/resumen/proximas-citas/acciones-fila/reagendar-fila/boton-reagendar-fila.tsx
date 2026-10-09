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
