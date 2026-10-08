import type { LucideIcon } from 'lucide-react'

/**
 * Botón de administración de la barra lateral ("Usuarios").
 *
 * Vive en `barra-lateral/botones/admin-lateral/`: llama a
 * `onAbrirModal(etiqueta)` al pulsarlo (abre el modal de Usuarios).
 */
export function BotonAdminLateral({
  etiqueta, Icono, onAbrirModal,
}: {
  etiqueta: string
  Icono: LucideIcon
  onAbrirModal: (titulo: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrirModal(etiqueta)}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-slate-500 hover:bg-slate-50"
    >
      <Icono size={18} />
      {etiqueta}
    </button>
  )
}
