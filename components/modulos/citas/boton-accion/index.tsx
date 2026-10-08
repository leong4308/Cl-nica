import { Plus } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'

/**
 * Botón principal genérico de la página de módulos (`citas/module-page.tsx`).
 *
 * Pinta el `config.action` que viene de `citas/configuracion-modulos.ts`
 * (`Nuevo paciente`, `Registrar médico`, …). Ninguno abre modal hoy:
 * `openModal()` de `app/page.tsx` los ignora porque no están en
 * `MODALES_CON_FORMULARIO`. Cada uno tiene su carpeta esperando el modal:
 * `pacientes/nuevo-paciente/`, `medicos/registrar-medico/`, etc.
 * La excepción es `'Nueva cita'`, que usa `citas/nueva-cita/`.
 */
export function BotonAccionModulo({ etiqueta, onAbrirModal }: { etiqueta: string; onAbrirModal: (titulo: string) => void }) {
  return <ActionButton primary icon={Plus} onClick={() => onAbrirModal(etiqueta)}>{etiqueta}</ActionButton>
}
