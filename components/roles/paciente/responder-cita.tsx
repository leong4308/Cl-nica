'use client'

import { useEffect, useState } from 'react'
import { ElegirTurno } from './elegir-turno'
import { Check, MessageSquare, CalendarClock } from 'lucide-react'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, AvisoClinico } from '@/components/modulos/compartidos/editor-clinico'

export function ResponderCita({ cita, onActualizar }: { cita: { id: number; inicio: string; estado: string; version?: string }; onActualizar: () => void }) {
  const [accion, setAccion] = useState<'cancelar' | 'reagendar' | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null), [mensaje, setMensaje] = useState<string | null>(null)
  const [solicitudes, setSolicitudes] = useState<{ id: number; cita_id: number; estado: string; disponibilidad: string; respuesta: string | null }[]>([])
  useEffect(() => { if (!cita.version) return; const c = new AbortController(); fetch('/api/citas/respuestas', { cache: 'no-store', signal: c.signal }).then(async r => { const b = await r.json(); if (!r.ok) throw Error(b.error); setSolicitudes(b.solicitudes ?? []) }).catch(e => { if (!c.signal.aborted) setError(e.message) }); return () => c.abort() }, [cita.id, cita.estado, cita.version, mensaje])
  const solicitud = solicitudes.find(s => s.cita_id === cita.id)
  const vigente = ['pendiente','confirmada'].includes(cita.estado) && Date.parse(cita.inicio) > Date.now()
  const puedeReagendar = vigente && Date.parse(cita.inicio) > Date.now()+2*60*60*1000
  async function enviar(tipo: 'confirmar' | 'cancelar') {
    setGuardando(true); setError(null); setMensaje(null)
    try {
      const r = await fetch('/api/citas/respuestas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId: cita.id, version: cita.version, accion: tipo, disponibilidad: null, confirmado: tipo === 'cancelar' }) }), b = await r.json()
      if (!r.ok) { if (r.status === 409) onActualizar(); throw Error(b.error || 'No se pudo guardar tu respuesta.') }
      setMensaje(b.mensaje); setAccion(null); onActualizar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo conectar.') }
    finally { setGuardando(false) }
  }
  return <section className="mt-5 border-t border-slate-100 pt-5">
    <h4 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare size={17} className="text-blue-600" />Tu respuesta a la cita</h4>
    {mensaje && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{mensaje}</p>}
    <AvisoClinico mensaje={error} />
    {solicitud && <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm"><p className="font-medium">{solicitud.estado === 'pendiente' ? 'Solicitud enviada a recepción' : solicitud.estado === 'reagendada' ? 'Cita reprogramada' : 'Solicitud atendida'}</p><p className="mt-2 whitespace-pre-wrap text-slate-600">Tu disponibilidad: {solicitud.disponibilidad}</p>{solicitud.respuesta && <p className="mt-2 whitespace-pre-wrap text-slate-700">{solicitud.respuesta}</p>}</div>}
    {vigente && !cita.version && <p className="mt-3 text-sm text-slate-500">Las respuestas de asistencia aún no están habilitadas. Contacta con recepción para confirmar o cambiar tu cita.</p>}
    {vigente && cita.version && <>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">Confirma si asistirás. Puedes elegir otro horario cuando falten más de dos horas para la cita.</p>
      {!accion ? <div className="mt-4 flex flex-wrap gap-2">
        {cita.estado === 'pendiente' && <button type="button" disabled={guardando} className={BOTON_PRIMARIO} onClick={() => { void enviar('confirmar') }}><Check size={16} />Sí asistiré</button>}
        <button type="button" disabled={guardando || !puedeReagendar} className={BOTON_SECUNDARIO} onClick={() => setAccion('reagendar')}><CalendarClock size={16} />Ver horarios libres</button>
        <button type="button" disabled={guardando} className="rounded-xl px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => setAccion('cancelar')}>Cancelar mi cita</button>
      </div> : accion === 'reagendar' ? <>{puedeReagendar && <ElegirTurno cita={cita} onGuardar={mensaje => {setMensaje(mensaje);setAccion(null);onActualizar()}} />}<button type="button" className={BOTON_SECUNDARIO + ' mt-3'} onClick={()=>setAccion(null)}>Volver</button></> : <form className="mt-4 rounded-2xl border border-slate-200 p-4" onSubmit={e=>{e.preventDefault();void enviar('cancelar')}}>
        <h5 className="text-sm font-semibold text-red-800">¿Confirmas que deseas cancelar?</h5><p className="mt-2 text-sm text-slate-600">Se liberará tu horario y se avisará al médico y a recepción.</p>
        <div className="mt-4 flex flex-wrap gap-2"><button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>{guardando?'Guardando respuesta...':'Sí, cancelar cita'}</button><button type="button" disabled={guardando} className={BOTON_SECUNDARIO} onClick={()=>setAccion(null)}>Volver</button></div>
      </form>}
      {!puedeReagendar && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Faltan dos horas o menos. Puedes confirmar asistencia o cancelar; ya no es posible reagendar.</p>}
    </>}
    {!vigente && !mensaje && <p className="mt-3 text-sm text-slate-500">Esta cita ya no admite respuestas de asistencia.</p>}
  </section>
}
