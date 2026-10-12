import type { LucideIcon } from 'lucide-react'

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
      {insignia !== undefined && insignia !== '' && (
        <small className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${activo ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
          {insignia}
        </small>
      )}
    </button>
  )
}
