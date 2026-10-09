import { Menu } from 'lucide-react'

export function BotonAbrirMenu({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" className="lg:hidden" onClick={onAbrir} aria-label="Abrir menú"><Menu size={21} /></button>
  )
}
