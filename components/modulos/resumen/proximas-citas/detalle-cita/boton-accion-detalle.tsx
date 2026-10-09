'use client'

import type { CitaPanel } from '@/lib/supabase/datos'

export function BotonAccionDetalle({
  etiqueta, color, cargando, onClick,
}: {
  etiqueta: string
  color: string
  cargando: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${color}`}
    >
      {etiqueta}
    </button>
  )
}

export type { CitaPanel }
