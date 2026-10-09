import { Download } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

export function BotonExportarModulo({ modulo, onAvisar }: { modulo: string; onAvisar: (mensaje: string) => void }) {
  return <ActionButton icon={Download} onClick={() => onAvisar(`Listado de ${modulo} exportado`)}>Exportar</ActionButton>
}
