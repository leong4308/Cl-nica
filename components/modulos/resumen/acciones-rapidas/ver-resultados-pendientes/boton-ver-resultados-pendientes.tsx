/**
 * Botón "Ver resultados pendientes" de las acciones rápidas.
 *
 * Vive en `acciones-rapidas/ver-resultados-pendientes/`.
 * Hoy abre el modal que aún no tiene, por lo que pulsarlo no hace nada hasta
 * que se implemente el modal.
 */
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
