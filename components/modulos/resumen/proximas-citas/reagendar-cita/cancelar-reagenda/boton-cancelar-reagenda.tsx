export function BotonCancelarReagenda({ onCancelar }: { onCancelar: () => void }) {
  return (
    <button type="button" onClick={onCancelar} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
      Cancelar
    </button>
  )
}
