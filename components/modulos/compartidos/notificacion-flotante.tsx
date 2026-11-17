'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, CircleAlert, X } from 'lucide-react'

export function NotificacionFlotante({ mensaje, onCerrar, tono = 'exito', children }: { mensaje: string; onCerrar: () => void; tono?: 'exito' | 'error'; children?: ReactNode }) {
  const cerrar = useRef(onCerrar), [restante, setRestante] = useState(5000)
  cerrar.current = onCerrar
  useEffect(() => {
    setRestante(5000)
    const inicio = performance.now()
    const progreso = window.setInterval(() => setRestante(Math.max(0, 5000 - (performance.now() - inicio))), 100)
    const timer = window.setTimeout(() => cerrar.current(), 5000)
    return () => { window.clearTimeout(timer); window.clearInterval(progreso) }
  }, [mensaje, tono])
  return <div role={tono === 'error' ? 'alert' : 'status'} aria-live={tono === 'error' ? 'assertive' : 'polite'} aria-atomic="true" className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-lg">
    <div className="flex items-start gap-3">
      <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full " + (tono === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>{tono === 'error' ? <CircleAlert size={23} /> : <CircleCheck size={23} />}</span>
      <div className="min-w-0 flex-1 self-center"><p className="text-sm font-semibold leading-relaxed">{mensaje}</p>{children}</div>
      <button type="button" aria-label="Cerrar notificación" className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={onCerrar}><X size={17} /></button>
    </div>
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-slate-100"><div className={"h-full " + (tono === 'error' ? 'bg-rose-400' : 'bg-emerald-400')} style={{ width: `${restante / 50}%` }} /></div>
  </div>
}
