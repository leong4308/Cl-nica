'use client'
import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
export function PreferenciasCorreo() {
  const [datos, setDatos] = useState<{ paciente: boolean; activo: boolean; correo: string | null; verificado: boolean; configurado: boolean } | null>(null), [error, setError] = useState(''), [guardando, setGuardando] = useState(false)
  useEffect(() => { const c = new AbortController(); fetch('/api/notificaciones/correo', { cache: 'no-store', signal: c.signal }).then(async r => { if (!r.ok) return; const b = await r.json(); if (!c.signal.aborted) setDatos(b) }).catch(() => {}); return () => c.abort() }, [])
  if (!datos?.paciente) return null
  async function cambiar(activo: boolean) {
    if (guardando) return
    const anterior = datos?.activo ?? !activo
    setDatos(d => d ? { ...d, activo } : d)
    setGuardando(true); setError('')
    try { const r = await fetch('/api/notificaciones/correo', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo }) }), b = await r.json(); if (!r.ok) throw Error(b.error); setDatos(d => d ? { ...d, ...b } : d) } catch (e) { setDatos(d => d ? { ...d, activo: anterior } : d); setError((e as Error).message) } finally { setGuardando(false) }
  }
  return <section className="mt-5 rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Mail size={17} className="text-blue-600" />Recordatorios por correo</h3><p className="mt-2 break-all text-xs text-slate-500">{datos.correo || 'No tienes un correo registrado.'}</p><label className="mt-3 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={datos.activo} disabled={guardando} onChange={e => void cambiar(e.target.checked)} />Recibir avisos y recordatorios de mis citas</label>{!datos.verificado && <p className="mt-2 text-xs text-amber-700">Los envíos se activarán cuando el correo esté verificado y coincida con tu cuenta.</p>}{!datos.configurado && <p className="mt-2 text-xs text-slate-500">La clínica todavía debe configurar el envío de correos.</p>}{error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}</section>
}
