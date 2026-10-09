import { X } from 'lucide-react'

export function BotonCerrarMenu({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" aria-label="Cerrar menú" onClick={onCerrar} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />
  )
}
