'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, MessageSquare, Phone } from 'lucide-react'
import { ModalEditarCita } from './editar/modal-editar-cita'
import { ModalMarco } from '../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO } from '../compartidos/editor-clinico'

type Solicitud = { origen?: string; id: number; cita_id: number; paciente: string; medico: string; telefono: string | null; inicio: string; estado: string; disponibilidad: string; respuesta: string | null; canal: string }
export function SolicitudesCambio() {
  const [filas, setFilas] = useState<Solicitud[]>([]), [error, setError] = useState<string | null>(null)
  const [editar, setEditar] = useState<number | null>(null), [responder, setResponder] = useState<Solicitud | null>(null)
  const [respuesta, setRespuesta] = useState(''), [guardando, setGuardando] = useState(false), [historial, setHistorial] = useState(false)
  const cargar = useCallback(async (signal?: AbortSignal) => {
    try { const r = await fetch('/api/citas/respuestas', { cache: 'no-store', signal }), b = await r.json(); if (!r.ok) throw Error(b.error); if (!signal?.aborted) { setFilas(b.solicitudes ?? []); setError(null) } }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'No se pudieron consultar las solicitudes.') }
  }, [])
  useEffect(() => { const c = new AbortController(), actualizar = () => { void cargar(c.signal) }; actualizar(); const t = window.setInterval(actualizar, 30_000); for (const evento of ['focus','datos-actualizados','notificaciones-nuevas']) window.addEventListener(evento, actualizar); return () => { c.abort(); window.clearInterval(t); for (const evento of ['focus','datos-actualizados','notificaciones-nuevas']) window.removeEventListener(evento, actualizar) } }, [cargar])
  async function cerrar(e: React.FormEvent) {
    e.preventDefault(); if (!responder) return; setGuardando(true); setError(null)
    try { const r = await fetch('/api/citas/respuestas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: responder.id, respuesta: respuesta.trim() }) }), b = await r.json(); if (!r.ok) throw Error(b.error); setResponder(null); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar la respuesta.') }
    finally { setGuardando(false) }
  }
  const pendientes = filas.filter(s => s.estado === 'pendiente'), visibles = historial ? filas : pendientes
  return <section aria-label="Solicitudes para reagendar" className="mb-6 rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><CalendarClock size={20} /></span><div><h3 className="text-base font-semibold">Solicitudes para reagendar <span className="ml-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-800">{pendientes.length} pendientes</span></h3><p className="mt-1 text-xs text-slate-500">Disponibilidad enviada por los pacientes desde Telegram o su portal.</p></div></div><button type="button" className="text-xs font-medium text-blue-700" onClick={() => setHistorial(!historial)}>{historial ? 'Ver pendientes' : 'Ver historial de solicitudes'}</button></div>
    <AvisoClinico mensaje={error} />
    {!visibles.length ? <p className="mt-5 text-sm text-slate-500">{historial ? 'Todavía no hay solicitudes de cambio.' : 'No hay solicitudes pendientes de revisar.'}</p> : <div className="mt-5 space-y-3">{visibles.map(s => <article key={s.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="text-sm font-semibold">{s.paciente} · Cita #{s.cita_id}</h4><span className="text-xs text-slate-500">{s.canal === 'telegram' ? 'Telegram' : 'Portal del paciente'} · {s.estado}</span></div><p className="mt-2 text-xs text-slate-500">{s.medico} · {new Date(s.inicio).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' })}</p><div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">{s.origen === 'medico' ? 'Motivo comunicado por el médico' : 'Días y horas en que puede asistir'}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.disponibilidad}</p></div>{s.respuesta && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{s.respuesta}</p>}{s.estado === 'pendiente' && <><p className="mt-3 text-xs text-slate-500">Acuerda el nuevo horario con el paciente antes de registrarlo. La reserva actual sigue vigente.</p><div className="mt-3 flex flex-wrap gap-2">{Date.parse(s.inicio) - Date.now() > 2 * 3600000 ? <button type="button" className={BOTON_PRIMARIO} onClick={() => setEditar(s.cita_id)}>Reagendar cita</button> : <p className="self-center text-xs text-amber-800">El plazo para reagendar terminó. Puedes responder al paciente para coordinar su asistencia o cancelación.</p>}<button type="button" className={BOTON_SECUNDARIO} onClick={() => { setResponder(s); setRespuesta('') }}><MessageSquare size={15} />Responder sin cambiar cita</button>{s.telefono && /^\+?\d{7,15}$/.test(s.telefono.replace(/[\s()-]/g,'')) && <a href={`tel:${s.telefono.replace(/[\s()-]/g,'')}`} className={BOTON_SECUNDARIO}><Phone size={15} />Contactar paciente</a>}</div></>}</article>)}</div>}
    {editar !== null && <ModalEditarCita citaId={editar} onClose={() => { setEditar(null); void cargar() }} />}
    {responder && <ModalMarco title={`Responder a ${responder.paciente}`} onClose={() => setResponder(null)}><form onSubmit={cerrar}><p className="text-sm text-slate-500">Tu respuesta llegará a su portal y, si tiene Telegram vinculado, también al bot. Esta opción conserva la fecha y hora actuales y cierra la solicitud.</p><label htmlFor="respuesta-recepcion" className="mt-4 block text-sm font-medium">Mensaje para el paciente</label><textarea id="respuesta-recepcion" required minLength={10} maxLength={1000} rows={4} value={respuesta} onChange={e => setRespuesta(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" /><AvisoClinico mensaje={error} /><button type="submit" disabled={guardando} className={BOTON_PRIMARIO + ' mt-4'}>{guardando ? 'Enviando respuesta...' : 'Enviar respuesta y cerrar solicitud'}</button></form></ModalMarco>}
  </section>
}
