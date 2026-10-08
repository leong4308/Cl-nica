/**
 * Botón "Ver camas e internaciones →" del panel de camas.
 *
 * Vive en `paneles-laterales/camas-internacion/` porque es donde se pinta
 * (`camas-internacion.tsx`): navega al módulo Internación, no abre modal.
 */
export function BotonVerCamas({ onVerCamas }: { onVerCamas: () => void }) {
  return (
    <button type="button" onClick={onVerCamas} className="mt-4 text-xs font-semibold text-blue-600">
      Ver camas e internaciones →
    </button>
  )
}
