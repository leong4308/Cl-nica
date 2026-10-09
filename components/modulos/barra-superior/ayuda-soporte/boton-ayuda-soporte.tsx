'use client'

import { LifeBuoy } from 'lucide-react'

export function BotonAyudaSoporte({ onAbrir }: { onAbrir: (modal: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir('Ayuda')}
      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      <LifeBuoy size={15} />
      Ayuda y soporte
    </button>
  )
}
