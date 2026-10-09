export function BotonGuardarCita({
  deshabilitado, guardando, onGuardar,
}: {
  deshabilitado: boolean
  guardando: boolean
  onGuardar: () => void
}) {
  return (
    <button
      type="button"
      onClick={onGuardar}
      disabled={deshabilitado || guardando}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {guardando ? 'Guardando…' : 'Guardar'}
    </button>
  )
}
