import { X } from 'lucide-react'

/**
 * Botón "Cerrar menú" de la página raíz (`app/page.tsx`).
 *
 * Vive en `app/botones-pagina/cerrar-menu/` porque solo se pinta ahí:
 * fondo semitransparente que cierra la barra lateral en móvil.
 */
export function BotonCerrarMenu({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" aria-label="Cerrar menú" onClick={onCerrar} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />
  )
}
