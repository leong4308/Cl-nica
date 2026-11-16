'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { horaClinica } from '@/lib/agenda/modelo'
import { BOTON_PRIMARIO } from '@/components/modulos/compartidos/editor-clinico'
type Estado = { id: number; estado: string; puedeIniciar: boolean; version: string; llegada: string | null; enConsulta: string | null }
export function EstadoLlegada({ citaId }: { citaId: number }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const clave = useRef<string | null>(null)
  const cargar = useCallback(async (signal: AbortSignal) => {
    try {
      const r = await fetch(`/api/recepcion?cita=${citaId}`, { cache: 'no-store', signal })
      const b = await r.json()
      if (!r.ok) throw Error(b.error || 'No se pudo consultar la llegada.')
      if (!signal.aborted) { setEstado(b); setError('') }
    } catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo consultar la llegada.') }
  }, [citaId])
  useEffect(() => {
    setEstado(null); clave.current = null
    const controller = new AbortController()
    const refrescar = () => void cargar(controller.signal)
    refrescar(); const intervalo = window.setInterval(refrescar, 30000)
    window.addEventListener('datos-actualizados', refrescar)
    return () => { controller.abort(); clearInterval(intervalo); window.removeEventListener('datos-actualizados', refrescar) }
  }, [cargar])
  async function iniciar() {
    if (!estado || guardando) return
    setGuardando(true); setError('')
    clave.current ??= crypto.randomUUID()
    try {
      const r = await fetch('/api/recepcion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId, version: estado.version, accion: 'iniciar', clave: clave.current }) })
      const b = await r.json()
      if (!r.ok) throw Error(b.error || 'No se pudo iniciar la consulta.')
      window.dispatchEvent(new Event('datos-actualizados'))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar la consulta.') }
    finally { setGuardando(false) }
  }
  return <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm"><p className="font-medium text-slate-800">{!estado ? 'Consultando el estado de llegada…' : estado.estado.startsWith('cancelada') ? 'Cita cancelada' : estado.estado === 'no_asistio' ? 'Inasistencia registrada' : estado.estado === 'atendida' ? 'Consulta finalizada' : estado?.enConsulta ? `Consulta iniciada a las ${horaClinica(estado.enConsulta)}` : estado?.llegada ? `Paciente en espera · Llegó a las ${horaClinica(estado.llegada)}` : 'Sin llegada registrada'}</p>{estado?.puedeIniciar && estado.llegada && !estado.enConsulta && ['pendiente', 'confirmada'].includes(estado.estado) && <button disabled={guardando || !!error} type="button" className={BOTON_PRIMARIO + ' mt-3'} onClick={() => void iniciar()}>{guardando ? 'Registrando…' : 'Iniciar atención'}</button>}{error && <div className="mt-2"><p role="alert" className="text-xs text-rose-700">{error}</p><button className="mt-2 text-xs font-semibold text-blue-700" type="button" onClick={() => window.dispatchEvent(new Event('datos-actualizados'))}>Actualizar llegada</button></div>}</div>
}
