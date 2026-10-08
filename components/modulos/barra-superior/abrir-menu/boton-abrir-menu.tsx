import { Menu } from 'lucide-react'

/**
 * Botón "Abrir menú" (hamburguesa) de la barra superior.
 *
 * Vive en `barra-superior/abrir-menu/`: solo sale en móvil (`lg:hidden`),
 * abre la barra lateral.
 */
export function BotonAbrirMenu({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" className="lg:hidden" onClick={onAbrir} aria-label="Abrir menú"><Menu size={21} /></button>
  )
}
