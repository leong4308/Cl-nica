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
