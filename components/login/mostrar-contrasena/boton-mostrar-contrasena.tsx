'use client'

import { Eye, EyeOff } from 'lucide-react'

export function BotonMostrarContrasena({
  visible, onAlternar,
}: {
  visible: boolean
  onAlternar: () => void
}) {
  return (
    <button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={onAlternar} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#64748b] hover:bg-[#e8f0ff]">
      <span className="sr-only">{visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}</span>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )
}
