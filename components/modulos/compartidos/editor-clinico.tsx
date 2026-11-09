import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export const CAMPO_CLINICO = 'mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:opacity-60'
export const ETIQUETA_CLINICA = 'block text-sm font-semibold text-slate-700'
export const BOTON_PRIMARIO = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50'
export const BOTON_SECUNDARIO = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-blue-600 disabled:opacity-50'

export function PanelClinico({ icon: Icon, titulo, ayuda, children, suave = false }: { icon: LucideIcon; titulo: string; ayuda?: string; children: ReactNode; suave?: boolean }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-200 p-4 sm:p-5 ${suave ? 'bg-slate-50/70' : 'bg-white'}`}>
    <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={18} /></span><div><h4 className="text-sm font-semibold text-slate-900">{titulo}</h4>{ayuda && <p className="mt-1 text-xs leading-relaxed text-slate-500">{ayuda}</p>}</div></div>
    {children}
  </section>
}

export function DatoClinico({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{etiqueta}</dt><dd className="mt-1 break-words text-sm font-medium leading-relaxed text-slate-800">{valor || 'Sin registrar'}</dd></div>
}

export function AvisoClinico({ mensaje }: { mensaje: string | null }) {
  return mensaje ? <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">{mensaje}</p> : null
}
