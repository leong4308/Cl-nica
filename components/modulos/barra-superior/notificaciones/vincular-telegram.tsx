'use client'

import { useCallback, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, AvisoClinico } from '@/components/modulos/compartidos/editor-clinico'

type Estado = { configurado: boolean; conectado: boolean; nombre: string | null; pendiente: { id: string; nombre: string } | null }
export function VincularTelegram() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [enlace, setEnlace] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const consultar = useCallback(async () => {
    try {
      const r = await fetch('/api/notificaciones/telegram', { cache: 'no-store' }), b = await r.json()
      if (!r.ok) throw Error(b.error)
      setEstado(b); setError(null)
    } catch { setError('No se pudo consultar Telegram. Usa Actualizar vinculación para reintentar.') }
  }, [])
  useEffect(() => { void consultar() }, [consultar])
  useEffect(() => {
    if (!enlace) return
    const t = window.setInterval(() => { void consultar() }, 5000)
    return () => window.clearInterval(t)
  }, [enlace, consultar])
  async function actuar(accion: string) {
    setOcupado(true); setError(null)
    try {
      const r = await fetch('/api/notificaciones/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, id: estado?.pendiente?.id }) }), b = await r.json()
      if (!r.ok) throw Error(b.error)
      if (b.enlace) setEnlace(b.enlace)
      else setEnlace('')
      await consultar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar.') }
    finally { setOcupado(false) }
  }
  return <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Send size={17} />Recordatorios en Telegram</h4>
    <p className="mt-2 text-xs leading-relaxed text-slate-500">Recibe los datos de tus citas y recordatorios aunque el portal esté cerrado. Vincula tu Telegram una vez; el número de teléfono por sí solo no activa los mensajes.</p>
    <AvisoClinico mensaje={error} />
    {estado?.conectado ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-emerald-700">Vinculado: {estado.nombre}</p><button disabled={ocupado} type="button" className={BOTON_SECUNDARIO} onClick={() => { void actuar('desvincular') }}>Desvincular Telegram</button></div> : estado?.pendiente ? <div className="mt-3 space-y-3"><p className="text-sm text-slate-700">Telegram respondió como <strong>{estado.pendiente.nombre}</strong>. Confirma solo si esa cuenta es tuya.</p><button disabled={ocupado} type="button" className={BOTON_PRIMARIO} onClick={() => { void actuar('confirmar') }}>Confirmar mi Telegram</button><button disabled={ocupado} type="button" className={BOTON_SECUNDARIO + ' ml-2'} onClick={() => { void actuar('desvincular') }}>Cancelar solicitud</button></div> : enlace ? <div className="mt-3 space-y-3"><a className={BOTON_PRIMARIO + ' inline-flex'} href={enlace} target="_blank" rel="noopener noreferrer">Abrir Telegram y pulsar Iniciar</a><p className="text-xs text-slate-500">Después vuelve aquí para confirmar tu cuenta. El enlace vence en diez minutos; no lo compartas.</p><button type="button" className={BOTON_SECUNDARIO} disabled={ocupado} onClick={() => { void actuar('vincular') }}>Generar otro enlace</button></div> : estado?.configurado ? <button type="button" disabled={ocupado} className={BOTON_PRIMARIO + ' mt-3'} onClick={() => { void actuar('vincular') }}>Vincular Telegram</button> : estado && <p className="mt-3 text-xs text-amber-800">El bot aún no está configurado. Los avisos dentro de Clínica Nova funcionan de forma independiente.</p>}
    <button type="button" className="mt-3 block text-xs font-medium text-blue-700" onClick={() => { void consultar() }}>Actualizar vinculación</button>
  </section>
}
