export function BotonActuales({
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
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${activo
        ? 'bg-blue-600 text-white'
        : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700'
        }`}
    >
      Actuales ({total})
    </button>
  )
}
