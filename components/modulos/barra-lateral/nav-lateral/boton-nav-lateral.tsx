import type { LucideIcon } from 'lucide-react'

/**
 * Botón de navegación de la barra lateral (Resumen, Citas, Pacientes…).
 *
 * Vive en `barra-lateral/botones/nav-lateral/`: la lista de etiquetas viene
 * de `barra-lateral/navegacion/items-menu.ts`, pero este `<button>` la pinta
 * (`barra-lateral.tsx`). Llama a `onNavegar(etiqueta)`.
 */
export function BotonNavLateral({
  etiqueta, Icono, activo, insignia, onNavegar,
}: {
  etiqueta: string
  Icono: LucideIcon
  activo: boolean
  insignia?: string
  onNavegar: (etiqueta: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onNavegar(etiqueta)}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium ${activo ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
    >
      <Icono size={18} strokeWidth={1.8} />
      <span className="flex-1">{etiqueta}</span>
      {insignia && <small className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px]">{insignia}</small>}
    </button>
  )
}
