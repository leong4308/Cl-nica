'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { ModalMarco } from '@/components/modulos/compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '@/components/modulos/compartidos/editor-clinico'

export function BotonOlvidoContrasena({ onAvisar: _onAvisar }: { onAvisar: (mensaje: string) => void }) {
  const [abierto, setAbierto] = useState(false), [correo, setCorreo] = useState(''), [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null), [enviado, setEnviado] = useState(false)
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); if (ocupado) return
    setOcupado(true); setError(null)
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(correo.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/restablecer-contrasena` })
      if (error) throw Error('No se pudo solicitar el enlace. Espera unos minutos e inténtalo de nuevo.')
      setEnviado(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo conectar con el servicio de acceso.') }
    finally { setOcupado(false) }
  }
  return <>
    <button type="button" onClick={() => { setAbierto(true); setEnviado(false); setError(null) }} className="font-medium text-[#1a56db] hover:underline">¿Olvidaste tu contraseña?</button>
    {abierto && createPortal(<ModalMarco title="Recuperar contraseña" onClose={() => { if (!ocupado) setAbierto(false) }}>
      {enviado ? <div role="status" className="space-y-4 text-sm leading-relaxed text-slate-600"><p>Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.</p><p>Abre el enlace en este navegador. Revisa también la carpeta de correo no deseado.</p><button type="button" className={BOTON_PRIMARIO} onClick={() => setAbierto(false)}>Volver al inicio de sesión</button></div> : <form onSubmit={enviar} className="space-y-4"><p className="text-sm leading-relaxed text-slate-500">Escribe el correo con el que accedes a Clínica Nova.</p><AvisoClinico mensaje={error} /><label className={ETIQUETA_CLINICA}>Correo de la cuenta<input type="email" autoComplete="email" required maxLength={150} className={CAMPO_CLINICO} value={correo} onChange={(e) => setCorreo(e.target.value)} disabled={ocupado} /></label><button type="submit" className={BOTON_PRIMARIO + ' w-full'} disabled={ocupado}>{ocupado ? 'Solicitando enlace...' : 'Enviar enlace de recuperación'}</button></form>}
    </ModalMarco>, document.body)}
  </>
}
