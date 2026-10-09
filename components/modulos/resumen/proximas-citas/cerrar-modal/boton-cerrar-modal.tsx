'use client'

import { X } from 'lucide-react'

export function BotonCerrarModal({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
  )
}
