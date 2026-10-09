import { X } from 'lucide-react'

export function BotonCerrarAviso({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" onClick={onCerrar} aria-label="Cerrar aviso"><X size={14} /></button>
  )
}
