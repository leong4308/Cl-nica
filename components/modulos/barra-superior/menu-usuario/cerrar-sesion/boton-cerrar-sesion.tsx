import type { LucideIcon } from 'lucide-react'

export function BotonCerrarSesion({
  etiqueta, Icono, onSalir,
}: {
  etiqueta: string
  Icono: LucideIcon
  onSalir: () => void
}) {
  return (
    <button type="button" role="menuitem" onClick={onSalir} className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50">
      <Icono size={16} className="shrink-0" />
      {etiqueta}
    </button>
  )
}
