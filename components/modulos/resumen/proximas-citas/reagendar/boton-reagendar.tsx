export function BotonReagendar({
  total, activo, onElegir,
}: {
  total: number
  activo: boolean
  onElegir: () => void
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={activo}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${activo ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
        }`}
    >
      Reagendar ({total})
    </button>
  )
}
