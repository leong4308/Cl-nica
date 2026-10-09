'use client'

import { KeyRound } from 'lucide-react'

export function BotonCambiarContrasena({ onAbrir }: { onAbrir: (modal: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir('Cambiar contraseña')}
      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      <KeyRound size={15} />
      Cambiar contraseña
    </button>
  )
}
