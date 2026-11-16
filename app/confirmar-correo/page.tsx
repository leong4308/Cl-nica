'use client'
import { useEffect, useRef, useState } from 'react'
import { MailCheck } from 'lucide-react'
import { BOTON_PRIMARIO } from '@/components/modulos/compartidos/editor-clinico'
export default function ConfirmarCorreo() {
  const token = useRef(''), [datos, setDatos] = useState<{ nombre?: string; correo?: string; confirmada?: boolean } | null>(null), [error, setError] = useState(''), [guardando, setGuardando] = useState(false)
  useEffect(() => {
    if (!token.current) { token.current = window.location.hash.slice(1); window.history.replaceState(null, '', window.location.pathname) }
    let vigente = true
    fetch('/api/portal/correo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'verificar', token: token.current }) }).then(async r => { const b = await r.json(); if (!r.ok) throw Error(b.error); if (vigente) setDatos(b) }).catch(e => { if (vigente) setError(e.message) })
    return () => { vigente = false }
  }, [])
  async function confirmar() {
    if (guardando) return
    setGuardando(true); setError('')
    try { const r = await fetch('/api/portal/correo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'confirmar', token: token.current }) }), b = await r.json(); if (!r.ok) throw Error(b.error); setDatos({ confirmada: true }); token.current = '' } catch (e) { setError((e as Error).message) } finally { setGuardando(false) }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><span className="inline-flex rounded-2xl bg-blue-600 p-3 text-white"><MailCheck size={28} /></span><p className="mt-5 text-xs font-semibold uppercase tracking-widest text-blue-600">Clínica Nova</p><h1 className="mt-2 text-2xl font-semibold">{datos?.confirmada ? 'Tu correo fue actualizado' : 'Confirma tu correo de acceso'}</h1>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}{datos?.confirmada ? <p role="status" className="mt-5 text-sm leading-relaxed text-slate-600">Ya puedes iniciar sesión con tu nuevo correo y tu contraseña habitual. Tu ficha, citas e historial se conservan.</p> : datos ? <div className="mt-5 space-y-4"><p className="text-sm leading-relaxed text-slate-600">Hola, <strong>{datos.nombre}</strong>. Al confirmar usarás esta dirección para acceder a tu cuenta:</p><p className="break-all rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">{datos.correo}</p><p className="text-xs leading-relaxed text-slate-500">Si no solicitaste el cambio, no lo confirmes y comunícate con recepción.</p><button className={BOTON_PRIMARIO + ' w-full'} disabled={guardando} onClick={() => void confirmar()}>{guardando ? 'Confirmando…' : 'Confirmar mi nuevo correo'}</button></div> : !error && <p className="mt-5 text-sm text-slate-500">Verificando enlace…</p>}<a className="mt-6 inline-block text-sm font-medium text-blue-600" href="/">Ir al inicio de sesión →</a></section></main>
}
