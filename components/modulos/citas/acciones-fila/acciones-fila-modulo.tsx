import { RowActions } from '../../compartidos/ui'

export function AccionesFilaModulo({ id, onAbrirModal }: { id: string; onAbrirModal: (titulo: string) => void }) {
  return (
    <RowActions
      onView={() => onAbrirModal(`Detalle: ${id}`)}
      onEdit={() => onAbrirModal(`Editar: ${id}`)}
      onDelete={() => onAbrirModal(`Eliminar: ${id}`)}
    />
  )
}
