import { Download } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

/**
 * Botón "Exportar" de la página genérica de módulos (`citas/module-page.tsx`).
 *
 * No abre modal: solo dispara un aviso con `notify`. Vive en su propia
 * carpeta, igual que el resto de botones de la página.
 */
export function BotonExportarModulo({ modulo, onAvisar }: { modulo: string; onAvisar: (mensaje: string) => void }) {
  return <ActionButton icon={Download} onClick={() => onAvisar(`Listado de ${modulo} exportado`)}>Exportar</ActionButton>
}
