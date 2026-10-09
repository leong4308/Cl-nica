export function BotonVerResultadosPendientes({ onAbrirModal }: { onAbrirModal: (title: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrirModal('Ver resultados pendientes')}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    >
      Ver resultados pendientes
    </button>
  )
}
