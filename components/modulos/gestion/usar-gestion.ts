'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { consultarGestion, guardarGestion, type ModuloGestion } from '@/lib/gestion/modelo'
export function usarGestion<T>(modulo: ModuloGestion, parametros = '') {
  const [datos, setDatos] = useState<T | null>(null), [error, setError] = useState(''), [mensaje, setMensaje] = useState(''), [cargando, setCargando] = useState(false), [guardando, setGuardando] = useState(false)
  const control = useRef<AbortController | null>(null), intento = useRef<{ firma: string; clave: string } | null>(null), enviando = useRef(false)
  const cargar = useCallback(async () => {
    control.current?.abort(); const c = new AbortController(); control.current = c; setCargando(true)
    try { const b = await consultarGestion<T>(modulo, parametros, c.signal); if (!c.signal.aborted) { setDatos(b); setError('') } } catch (e) { if (!c.signal.aborted) setError((e as Error).message) } finally { if (!c.signal.aborted) setCargando(false) }
  }, [modulo, parametros])
  useEffect(() => { setDatos(null); void cargar(); const actualizar = () => { if (!document.hidden && !enviando.current) void cargar() }; const t = window.setInterval(actualizar, 30000); window.addEventListener('notificaciones-nuevas', actualizar); window.addEventListener('focus', actualizar); window.addEventListener('datos-actualizados', actualizar); return () => { control.current?.abort(); clearInterval(t); window.removeEventListener('notificaciones-nuevas', actualizar); window.removeEventListener('focus', actualizar); window.removeEventListener('datos-actualizados', actualizar) } }, [cargar])
  async function guardar(accion: string, payload: Record<string, unknown>) {
    if (enviando.current) return null
    const firma = JSON.stringify({ modulo, accion, payload }); if (intento.current?.firma !== firma) intento.current = { firma, clave: crypto.randomUUID() }
    enviando.current = true; setGuardando(true); setError(''); setMensaje('')
    try { const r = await guardarGestion(modulo, accion, payload, intento.current.clave); intento.current = null; setMensaje(r.mensaje); await cargar(); return r } catch (e) { setError((e as Error).message); return null } finally { enviando.current = false; setGuardando(false) }
  }
  return { datos, error, mensaje, cargando, guardando, cargar, guardar, setError, setMensaje }
}
