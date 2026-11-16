'use client'
import { useEffect, useRef, useState } from 'react'
import { HeartPulse, KeyRound } from 'lucide-react'
import { BOTON_PRIMARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '@/components/modulos/compartidos/editor-clinico'
import { validarNuevaContrasena } from '@/lib/cuenta/recuperacion'
export default function ActivarCuenta() {
  const token = useRef(''), [datos, setDatos] = useState<{ nombre?: string; correo?: string; activada?: boolean } | null>(null)
  const [error, setError] = useState(''), [nueva, setNueva] = useState(''), [confirmacion, setConfirmacion] = useState(''), [guardando, setGuardando] = useState(false)
  useEffect(() => {
    // El secreto está en el fragmento: no se envía en URL, registros ni Referer.
    if (!token.current) { token.current = window.location.hash.slice(1); window.history.replaceState(null, '', window.location.pathname) }
    let vigente = true
    fetch('/api/portal/activacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'verificar', token: token.current }) }).then(async r => { const b = await r.json(); if (!r.ok) throw Error(b.error); if (vigente) setDatos(b) }).catch(e => { if (vigente) setError(e.message || 'No se pudo comprobar el enlace.') })
    return () => { vigente = false }
  }, [])
  async function activar(e: React.FormEvent) {
    e.preventDefault(); if (guardando) return
    const v = validarNuevaContrasena(nueva, confirmacion)
    if (v) { setError(v); return }
    setGuardando(true); setError('')
    try {
      const r = await fetch('/api/portal/activacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'activar', token: token.current, nueva, confirmacion }) }), b = await r.json()
      if (!r.ok) throw Error(b.error)
      setDatos({ activada: true }); setNueva(''); setConfirmacion(''); token.current = ''
    } catch (e) { setError((e as Error).message || 'No se pudo activar tu cuenta.') } finally { setGuardando(false) }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><span className="inline-flex rounded-2xl bg-blue-600 p-3 text-white"><HeartPulse size={28} /></span><p className="mt-5 text-xs font-semibold uppercase tracking-widest text-blue-600">Portal del paciente</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">{datos?.activada ? 'Tu cuenta está activada' : 'Bienvenido a Clínica Nova'}</h1>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}{datos?.activada ? <p role="status" className="mt-4 text-sm leading-relaxed text-slate-600">Ya puedes iniciar sesión con tu correo y la contraseña que elegiste. Si ya habías activado tu cuenta y no la recuerdas, usa «¿Olvidaste tu contraseña?».</p> : datos ? <form onSubmit={activar} className="mt-5 space-y-4"><p className="text-sm leading-relaxed text-slate-600">Hola, <strong>{datos.nombre}</strong>. Tu cuenta se vinculará con la ficha que registró la clínica.</p><p className="break-all rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{datos.correo}</p><p className="text-xs leading-relaxed text-slate-500">Elige una contraseña de 12 a 128 caracteres con mayúsculas, minúsculas y números. Solo tú necesitas conocerla.</p><label className={ETIQUETA_CLINICA}>Contraseña<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={CAMPO_CLINICO} value={nueva} onChange={e => setNueva(e.target.value)} disabled={guardando} /></label><label className={ETIQUETA_CLINICA}>Confirmar contraseña<input type="password" autoComplete="new-password" required className={CAMPO_CLINICO} value={confirmacion} onChange={e => setConfirmacion(e.target.value)} disabled={guardando} /></label><button disabled={guardando} className={BOTON_PRIMARIO + ' w-full'}><KeyRound size={16} />{guardando ? 'Activando…' : 'Activar mi cuenta'}</button></form> : !error && <p role="status" className="mt-5 text-sm text-slate-500">Verificando tu invitación…</p>}<a className="mt-6 inline-block text-sm font-medium text-blue-600" href="/">Ir al inicio de sesión →</a></section></main>
}
