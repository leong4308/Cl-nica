'use client'
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { fechaClinica, sumarDias } from '@/lib/agenda/modelo'
import { AvisoClinico, BOTON_SECUNDARIO } from '@/components/modulos/compartidos/editor-clinico'

type Turno = { inicio: string; fin: string }
type Agenda = { permitido: boolean; configurado: boolean; motivo?: string | null; desde?: string; hasta?: string; turnos: Turno[] }
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
const fecha = (dia: string) => new Date(dia+'T12:00:00Z').toLocaleDateString('es-MX',{timeZone:'America/Mexico_City',weekday:'long',day:'numeric',month:'long'})
export function ElegirTurno({ cita, onGuardar }: { cita: { id: number; version?: string }; onGuardar: (mensaje: string) => void }) {
  const [desde, setDesde] = useState(() => fechaClinica()), [agenda, setAgenda] = useState<Agenda | null>(null)
  const [dia, setDia] = useState(''), [error, setError] = useState<string | null>(null), [guardando, setGuardando] = useState(false), [cargando,setCargando] = useState(false)
  const cargar = useCallback(async (signal?: AbortSignal) => {
    setCargando(true)
    try { const q=new URLSearchParams({citaId:String(cita.id),version:cita.version??'',desde}),r=await fetch('/api/citas/turnos?'+q,{cache:'no-store',signal}),b=await r.json(); if(!r.ok) throw Error(b.error); if(!signal?.aborted){setAgenda(b);setDia(b.turnos[0]?fechaClinica(new Date(b.turnos[0].inicio)):'');setError(null)} }
    catch(e) { if(!signal?.aborted){setError(e instanceof Error?e.message:'No se pudo consultar la agenda.');setAgenda(null)} }
    finally{if(!signal?.aborted)setCargando(false)}
  },[cita.id,cita.version,desde])
  useEffect(()=>{const c=new AbortController();void cargar(c.signal);return()=>c.abort()},[cargar])
  const dias=[...new Set(agenda?.turnos.map(t=>fechaClinica(new Date(t.inicio)))??[])]
  async function elegir(t: Turno) {
    setGuardando(true);setError(null)
    try { const r=await fetch('/api/citas/turnos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({citaId:cita.id,version:cita.version,inicio:t.inicio})}),b=await r.json();if(!r.ok)throw Error(b.error);onGuardar(b.mensaje) }
    catch(e){const mensaje=e instanceof Error?e.message:'No se pudo guardar el turno.';await cargar();setError(mensaje)}
    finally{setGuardando(false)}
  }
  return <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-4"><h5 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock size={17}/>Horarios libres con tu médico</h5><p className="mt-2 text-xs leading-relaxed text-slate-600">Al tocar un horario se cambia tu cita y se confirma tu asistencia. Se avisará al médico y a recepción. Hora de Ciudad de México.</p><AvisoClinico mensaje={error}/>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><button type="button" aria-label="Semana anterior" disabled={guardando||cargando||desde<=fechaClinica()} className={BOTON_SECUNDARIO} onClick={()=>{setAgenda(null);setDesde(sumarDias(desde,-7)<fechaClinica()?fechaClinica():sumarDias(desde,-7))}}><ChevronLeft size={16}/></button><p className="text-xs text-slate-600">{fecha(desde)} — {fecha(sumarDias(desde,6))}</p><button type="button" aria-label="Semana siguiente" disabled={guardando||cargando||desde>=sumarDias(fechaClinica(),56)} className={BOTON_SECUNDARIO} onClick={()=>{setAgenda(null);setDesde(sumarDias(desde,7))}}><ChevronRight size={16}/></button></div>
    {cargando && <p role="status" className="mt-4 text-sm text-slate-500">Consultando horarios libres...</p>}
    {agenda && (!agenda.permitido||!agenda.configurado||!agenda.turnos.length) && <p className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-600">{agenda.motivo||'No hay horarios libres en esta semana.'}</p>}
    {!!dias.length && <><div className="mt-4 flex flex-wrap gap-2">{dias.map(d=><button type="button" key={d} disabled={guardando} aria-pressed={dia===d} onClick={()=>setDia(d)} className={`rounded-xl border px-3 py-2 text-xs ${dia===d?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-white text-slate-600'}`}>{fecha(d)}</button>)}</div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{agenda!.turnos.filter(t=>fechaClinica(new Date(t.inicio))===dia).map(t=><button type="button" key={t.inicio} disabled={guardando||cargando} className="rounded-xl border border-blue-100 bg-white px-3 py-3 text-sm font-medium text-blue-800 hover:border-blue-600 hover:bg-blue-50 disabled:opacity-50" onClick={()=>{void elegir(t)}}>{hora(t.inicio)} – {hora(t.fin)}</button>)}</div></>}
    {guardando && <p role="status" className="mt-3 text-sm text-blue-700">Actualizando tu cita...</p>}
  </div>
}
