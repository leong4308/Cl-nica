'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Notificacion = { id: number; tipo: string; titulo: string; mensaje: string; cita_id: number | null; creado_en: string; leida_en: string | null }

export function usarNotificaciones(usuarioId?: number) {
  const [avisos, setAvisos] = useState<Notificacion[]>([])
  const [sinLeer, setSinLeer] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [sonido, setSonido] = useState(false)
  const audio = useRef<AudioContext | null>(null)
  const sonidoActivo = useRef(false)
  const ultimo = useRef<number | null>(null)
  const secuencia = useRef(0)
  const vigente = useRef(true)

  const tocar = useCallback(() => {
    const ctx = audio.current
    if (!ctx || ctx.state !== 'running') return
    for (const [offset, frecuencia] of [[0, 880], [0.11, 660]]) {
      const tono = ctx.createOscillator(), volumen = ctx.createGain(), inicio = ctx.currentTime + offset
      tono.frequency.value = frecuencia
      volumen.gain.setValueAtTime(0, inicio)
      volumen.gain.linearRampToValueAtTime(0.055, inicio + 0.01)
      volumen.gain.exponentialRampToValueAtTime(0.001, inicio + 0.12)
      tono.connect(volumen); volumen.connect(ctx.destination)
      tono.start(inicio); tono.stop(inicio + 0.13)
      tono.onended = () => { tono.disconnect(); volumen.disconnect() }
    }
  }, [])
  const refrescar = useCallback(async () => {
    if (!usuarioId) return
    const solicitud = ++secuencia.current
    try {
      const r = await fetch('/api/notificaciones', { cache: 'no-store' }), b = await r.json()
      if (!r.ok) throw Error(b.error || 'No se pudieron consultar los avisos.')
      if (!vigente.current || solicitud !== secuencia.current) return
      const filas: Notificacion[] = b.notificaciones ?? [], maximo = filas[0]?.id ?? 0
      if (ultimo.current !== null && maximo > ultimo.current) window.dispatchEvent(new Event('notificaciones-nuevas'))
      if (ultimo.current !== null && filas.some(n => n.id > ultimo.current! && !n.leida_en) && sonidoActivo.current) tocar()
      ultimo.current = Math.max(ultimo.current ?? 0, maximo)
      setAvisos(filas); setSinLeer(b.sinLeer ?? 0); setError(null)
    } catch (e) {
      if (vigente.current && solicitud === secuencia.current) setError(e instanceof Error ? e.message : 'No se pudo consultar.')
    }
  }, [usuarioId, tocar])
  useEffect(() => {
    vigente.current = true; ultimo.current = null
    setAvisos([]); setSinLeer(0); setError(null)
    try { sonidoActivo.current = localStorage.getItem(`cn-sonido-${usuarioId}`) === 'true' } catch { sonidoActivo.current = false }
    setSonido(sonidoActivo.current)
    const habilitarAudio = () => {
      if (!sonidoActivo.current) return
      try { audio.current ??= new AudioContext(); void audio.current.resume().catch(() => {}) } catch { /* El botón permite reintentar. */ }
    }
    document.addEventListener('pointerdown', habilitarAudio); document.addEventListener('keydown', habilitarAudio)
    void refrescar()
    const timer = window.setInterval(() => { void refrescar() }, 15_000)
    const actualizar = () => { void refrescar() }
    window.addEventListener('focus', actualizar); window.addEventListener('datos-actualizados', actualizar)
    const db = createClient()
    const canal = usuarioId ? db.channel(`notificaciones-${usuarioId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${usuarioId}` }, () => { actualizar(); window.dispatchEvent(new Event('datos-actualizados')) }).subscribe() : null
    return () => {
      vigente.current = false; secuencia.current++
      window.clearInterval(timer)
      window.removeEventListener('focus', actualizar); window.removeEventListener('datos-actualizados', actualizar)
      document.removeEventListener('pointerdown', habilitarAudio); document.removeEventListener('keydown', habilitarAudio)
      if (canal) void db.removeChannel(canal)
      void audio.current?.close().catch(() => {}); audio.current = null
    }
  }, [usuarioId, refrescar])
  async function alternarSonido() {
    const activar = !sonidoActivo.current
    if (activar) {
      try {
        audio.current ??= new AudioContext(); await audio.current.resume()
        if (audio.current.state !== 'running') throw Error('Audio bloqueado')
      } catch { setError('El navegador bloqueó el audio. Permite el sonido del sitio y vuelve a intentarlo.'); return }
    }
    sonidoActivo.current = activar; setSonido(activar)
    try { localStorage.setItem(`cn-sonido-${usuarioId}`, String(activar)) } catch { /* Se mantiene durante esta sesión. */ }
    if (activar) tocar()
  }
  async function marcar(id?: number) {
    if (!avisos.length) return
    try {
      const r = await fetch('/api/notificaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { todas: true, hasta: avisos[0].id }) })
      if (!r.ok) throw Error('No se pudo marcar como leído. Inténtalo de nuevo.')
      await refrescar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') }
  }
  return { avisos, sinLeer, error, sonido, alternarSonido, marcar, refrescar }
}
