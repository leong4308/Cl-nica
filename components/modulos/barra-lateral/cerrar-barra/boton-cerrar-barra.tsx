import { X } from 'lucide-react'

/**
 * Botón "Cerrar" (✕) de la barra lateral.
 *
 * Vive en `barra-lateral/cerrar-barra/`: solo se pinta en móvil
 * (`lg:hidden`) en `barra-lateral.tsx` para cerrar el panel.
 */
export function BotonCerrarBarra({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" className="ml-auto lg:hidden" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
  )
}
