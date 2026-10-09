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
