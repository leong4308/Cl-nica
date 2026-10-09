import { X } from 'lucide-react'

export function BotonCerrarBarra({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" className="ml-auto lg:hidden" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
  )
}
