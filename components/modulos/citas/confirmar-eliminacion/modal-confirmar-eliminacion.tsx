import { ModalMarco } from '../../compartidos/modal-marco'

export function ModalConfirmarEliminacion({
  citaId,
  onClose,
  onConfirm,
}: {
  citaId: number
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ModalMarco title="Eliminar cita" onClose={onClose}>
      <p className="text-sm text-slate-600">
        ¿Seguro que desea eliminar esta cita? Esta acción no se puede deshacer.
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
        >
          Eliminar
        </button>
      </div>
    </ModalMarco>
  )
}