import type { ReactNode } from 'react'
import { Check, Eye, Edit3, Trash2 } from 'lucide-react'

export function ActionButton({ children, icon: Icon, primary, onClick }: { children: ReactNode; icon: typeof Check; primary?: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm ${primary ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><Icon size={15} />{children}</button> }
export function Stat({ icon: Icon, label, value, meta, tone }: { icon: typeof Check; label: string; value: string; meta: string; tone: string }) { const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600', orange: 'bg-orange-50 text-orange-600', green: 'bg-emerald-50 text-emerald-600' }; return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">{label}</p><b className="mt-2 block text-[26px] tracking-tight">{value}</b></div><span className={`flex size-9 items-center justify-center rounded-lg ${colors[tone]}`}><Icon size={17} /></span></div><p className="mt-3 text-[11px] text-slate-400">{meta}</p></div> }
export function RowActions({
  onView,
  onEdit,
  onAction,
  onDelete,
}: {
  onView: () => void
  onEdit?: () => void
  onAction?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Ver detalle"
        title="Ver detalle"
        onClick={onView}
        className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
      >
        <Eye size={15} />
      </button>
      {onEdit && (
        <button
          type="button"
          aria-label="Editar registro"
          title="Editar registro"
          onClick={onEdit}
          className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
        >
          <Edit3 size={15} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          aria-label="Eliminar registro"
          title="Eliminar registro"
          onClick={onDelete}
          className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      )}
      {onAction && (
        <button
          type="button"
          aria-label="Marcar como completado"
          title="Marcar como completado"
          onClick={onAction}
          className="rounded-md p-2 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
        >
          <Check size={15} />
        </button>
      )}
    </div>
  )
}
