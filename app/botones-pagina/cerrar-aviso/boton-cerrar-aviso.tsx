import { X } from 'lucide-react'

/**
 * Botón "Cerrar aviso" de la página raíz (`app/page.tsx`).
 *
 * Vive en `app/botones-pagina/cerrar-aviso/` porque solo se pinta ahí:
 * la ✕ del aviso flotante inferior.
 */
export function BotonCerrarAviso({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" onClick={onCerrar} aria-label="Cerrar aviso"><X size={14} /></button>
  )
}
