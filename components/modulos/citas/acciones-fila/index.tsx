import { RowActions } from '../../compartidos/ui'

/**
 * Botones "Detalle" / "Editar" por fila de la tabla de módulos
 * (`citas/module-page.tsx`).
 *
 * Todavía no tienen formulario: `openModal('Detalle: X')` y
 * `openModal('Editar: X')` los ignora `MODALES_CON_FORMULARIO` de
 * `app/page.tsx`, así que pulsarlos no abre nada.
 */
export function AccionesFilaModulo({ id, onAbrirModal }: { id: string; onAbrirModal: (titulo: string) => void }) {
  return <RowActions onView={() => onAbrirModal(`Detalle: ${id}`)} onEdit={() => onAbrirModal(`Editar: ${id}`)} />
}
