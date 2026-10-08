import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'
import { ModalNuevaCita } from '../../resumen/acciones-rapidas/nueva-cita'

/**
 * Botón principal de la página de Citas: "Nueva cita".
 *
 * Es el ÚNICO `config.action` de `citas/configuracion-modulos.ts` que sí
 * abre modal, y ese modal ya vive en
 * `resumen/acciones-rapidas/nueva-cita/modal-nueva-cita.tsx`. Esta carpeta
 * reexporta el botón junto al modal para dejar constancia del vínculo.
 */
export function BotonNuevaCitaModulo({ onAbrirModal }: { onAbrirModal: (titulo: string) => void }) {
  return <ActionButton primary icon={Plus} onClick={() => onAbrirModal('Nueva cita')}>Nueva cita</ActionButton>
}

export { ModalNuevaCita }
