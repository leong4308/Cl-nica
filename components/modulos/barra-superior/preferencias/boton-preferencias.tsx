'use client'

import { Wrench } from 'lucide-react'

export function BotonPreferencias({ onAbrir }: { onAbrir: (modal: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir('Preferencias')}
      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      <Wrench size={15} />
      Preferencias
    </button>
  )
}
