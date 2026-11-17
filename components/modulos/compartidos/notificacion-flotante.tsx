'use client'
import { useEffect, useRef, useState } from 'react'
import { CircleCheck, X } from 'lucide-react'

export function NotificacionFlotante({ mensaje, onCerrar }: { mensaje: string; onCerrar: () => void }) {
  const cerrar = useRef(onCerrar), [pausada, setPausada] = useState(false)
  cerrar.current = onCerrar
  useEffect(() => {
    if (pausada) return
    const timer = window.setTimeout(() => cerrar.current(), 5000)
    return () => window.clearTimeout(timer)
  }, [mensaje, pausada])
  return <div role="status" aria-live="polite" aria-atomic="true" className="fixed right-4 top-4 z-10 flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-slate-800 shadow-xl sm:right-6 sm:top-6" onMouseEnter={() => setPausada(true)} onMouseLeave={() => setPausada(false)} onFocusCapture={() => setPausada(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausada(false) }}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CircleCheck size={23} /></span>
    <p className="min-w-0 flex-1 self-center text-sm font-semibold leading-relaxed">{mensaje}</p>
    <button type="button" aria-label="Cerrar notificación" className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-emerald-600" onClick={onCerrar}><X size={17} /></button>
  </div>
}
