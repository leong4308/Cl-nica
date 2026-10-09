export function BotonGuardarUsuarios({ onGuardar }: { onGuardar: () => void }) {
  return (
    <button
      type="button"
      onClick={onGuardar}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
    >
      Guardar
    </button>
  )
}
