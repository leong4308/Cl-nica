import { Filter } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

/**
 * Botón "Filtrar" de la página genérica de módulos (`citas/module-page.tsx`).
 *
 * Todavía no tiene formulario: `openModal('Filtros de X')` lo ignora
 * `MODALES_CON_FORMULARIO` de `app/page.tsx`, así que pulsarlo no abre nada.
 * Existe para que el hueco quede visible en la carpeta de su botón.
 */
export function BotonFiltrarModulo({ modulo, onAbrirModal }: { modulo: string; onAbrirModal: (titulo: string) => void }) {
  return <ActionButton icon={Filter} onClick={() => onAbrirModal(`Filtros de ${modulo}`)}>Filtrar</ActionButton>
}
