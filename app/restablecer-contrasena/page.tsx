'use client'
import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { AvisoClinico, BOTON_PRIMARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '@/components/modulos/compartidos/editor-clinico'
import { validarNuevaContrasena } from '@/lib/cuenta/recuperacion'

export default function RestablecerContrasena() {
  const [valido, setValido] = useState<boolean | null>(null), [nueva, setNueva] = useState(''), [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null), [guardando, setGuardando] = useState(false), [listo, setListo] = useState(false)
  useEffect(() => { let vigente = true; fetch('/api/auth/restablecer', { cache: 'no-store' }).then(r => r.json()).then(r => { if (vigente) setValido(r.valido === true) }).catch(() => { if (vigente) setValido(false) }); return () => { vigente = false } }, [])
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (guardando) return
    const validacion = validarNuevaContrasena(nueva, confirmacion)
    if (validacion) { setError(validacion); return }
    setGuardando(true); setError(null)
    try {
      const r = await fetch('/api/auth/restablecer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nueva, confirmacion }) }), datos = await r.json()
      if (!r.ok) throw Error(datos.error)
      setNueva(''); setConfirmacion(''); setListo(true); setError(datos.advertencia ?? null)
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo conectar con el servicio de acceso.') } finally { setGuardando(false) }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><section className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="inline-flex rounded-xl bg-blue-50 p-3 text-blue-600"><KeyRound /></span><h1 className="text-2xl font-semibold text-slate-900">Nueva contraseña</h1><AvisoClinico mensaje={error} />{listo ? <p role="status" className="text-sm text-emerald-700">Tu contraseña se actualizó. Ya puedes iniciar sesión con ella.</p> : valido === null ? <p role="status">Verificando enlace...</p> : !valido ? <p role="alert" className="text-sm leading-relaxed text-slate-600">El enlace es inválido o expiró. Vuelve al inicio y solicita otro desde «¿Olvidaste tu contraseña?».</p> : <form onSubmit={guardar} className="space-y-4"><p className="text-sm text-slate-500">Usa al menos 12 caracteres con mayúsculas, minúsculas y números.</p><label className={ETIQUETA_CLINICA}>Nueva contraseña<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={guardando} className={CAMPO_CLINICO} value={nueva} onChange={e => setNueva(e.target.value)} /></label><label className={ETIQUETA_CLINICA}>Confirmar contraseña<input type="password" autoComplete="new-password" required disabled={guardando} className={CAMPO_CLINICO} value={confirmacion} onChange={e => setConfirmacion(e.target.value)} /></label><button className={BOTON_PRIMARIO + ' w-full'} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar nueva contraseña'}</button></form>}<a href="/" className="inline-block text-sm font-medium text-blue-600">Volver al inicio de sesión</a></section></main>
}
