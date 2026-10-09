'use client'

import { Bell } from 'lucide-react'

export function BotonNotificaciones({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" onClick={onAbrir} aria-label="Notificaciones" className="relative text-slate-500">
      <Bell size={20} />
      <i className="absolute -right-1 -top-1 size-2 rounded-full bg-blue-600 ring-2 ring-white" />
    </button>
  )
}
