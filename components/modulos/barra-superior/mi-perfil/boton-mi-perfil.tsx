'use client'

import { User } from 'lucide-react'

export function BotonMiPerfil({ onAbrir }: { onAbrir: (modal: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir('Perfil')}
      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      <User size={15} />
      Mi perfil
    </button>
  )
}
