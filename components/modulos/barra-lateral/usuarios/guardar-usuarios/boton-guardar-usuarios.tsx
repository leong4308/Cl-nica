export function BotonGuardarUsuarios({
  onGuardar,
  guardando,
}: {
  onGuardar: () => void
  guardando?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onGuardar}
      disabled={guardando}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {guardando ? 'Guardando...' : 'Crear usuario'}
    </button>
  )
}

