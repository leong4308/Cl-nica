'use client'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { ModalMarco } from '@/components/modulos/compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/components/modulos/compartidos/editor-clinico'
import { fechaClinica, sumarDias } from '@/lib/agenda/modelo'

type Medico = { id: number; nombre: string; especialidad: string; clinica: string; publicado: boolean }
type Datos = { paciente: { nombre: string; correo: string; telefono: string | null }; medicos: Medico[] }
type Turno = { inicio: string; fin: string }
type Agenda = { configurado: boolean; motivo?: string; turnos: Turno[] }
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const fecha = (dia: string) => new Date(dia + 'T12:00:00Z').toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short' })
export function AgendarCita({ onClose, onGuardar, medicoInicial, medicoFijo = false, desdeInicial, motivoInicial = '' }: { onClose: () => void; onGuardar: (mensaje: string, citaId?: number) => void; medicoInicial?: number; medicoFijo?: boolean; desdeInicial?: string; motivoInicial?: string }) {
  const [datos, setDatos] = useState<Datos | null>(null), [medico, setMedico] = useState(medicoInicial ? String(medicoInicial) : ''), [desde, setDesde] = useState(desdeInicial && desdeInicial > fechaClinica() ? desdeInicial : fechaClinica())
  const [agenda, setAgenda] = useState<Agenda | null>(null), [dia, setDia] = useState(''), [turno, setTurno] = useState<Turno | null>(null), [motivo, setMotivo] = useState(motivoInicial)
  const [error, setError] = useState<string | null>(null), [ocupado, setOcupado] = useState(false), [consultando, setConsultando] = useState(false), [revision, setRevision] = useState(0)
  const clave = useRef(''), enviando = useRef(false)
  useEffect(() => {
    const c = new AbortController()
    fetch('/api/citas/reservar', { cache: 'no-store', signal: c.signal }).then(async r => { const b = await r.json(); if (!r.ok) throw Error(b.error); setDatos(b) }).catch(e => { if (!c.signal.aborted) setError(e.message) })
    return () => c.abort()
  }, [])
  useEffect(() => {
    setTurno(null); setAgenda(null); clave.current = crypto.randomUUID()
    if (!medico) return
    const c = new AbortController(); setConsultando(true); setError(null)
    fetch('/api/citas/reservar?' + new URLSearchParams({ medico, desde }), { cache: 'no-store', signal: c.signal }).then(async r => {
      const b = await r.json(); if (!r.ok) throw Error(b.error)
      if (!c.signal.aborted) { setAgenda(b); setDia(b.turnos[0] ? fechaClinica(new Date(b.turnos[0].inicio)) : '') }
    }).catch(e => { if (!c.signal.aborted) setError(e.message) }).finally(() => { if (!c.signal.aborted) setConsultando(false) })
    return () => c.abort()
  }, [medico, desde, revision])
  const elegido = datos?.medicos.find(m => String(m.id) === medico), dias = [...new Set(agenda?.turnos.map(t => fechaClinica(new Date(t.inicio))) ?? [])]
  async function guardar() {
    if (!turno || enviando.current) return
    enviando.current = true; setOcupado(true); setError(null)
    try {
      const r = await fetch('/api/citas/reservar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico: Number(medico), ...turno, motivo, clave: clave.current }) }), b = await r.json()
      if (!r.ok) { if (r.status === 409) { setTurno(null); setRevision(v => v + 1) } throw Error(b.error) }
      onGuardar(b.mensaje, b.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar tu cita. Puedes volver a intentar sin duplicarla.') }
    finally { enviando.current = false; setOcupado(false) }
  }
  return <ModalMarco title="Agendar mi cita" ancho="max-w-3xl" onClose={() => { if (!ocupado) onClose() }}>
    <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><ShieldCheck size={22} className="shrink-0 text-blue-700" /><div><p className="text-sm font-semibold">{datos?.paciente.nombre || 'Tu cuenta de paciente'}</p><p className="mt-1 text-xs text-slate-600">{datos ? [datos.paciente.correo, datos.paciente.telefono].filter(Boolean).join(' · ') : 'Consultando los datos de tu sesión...'}</p><p className="mt-2 text-xs text-slate-500">Usaremos tus datos registrados. Todos los horarios corresponden a Ciudad de México.</p></div></div>
    <AvisoClinico mensaje={error} />
    {turno ? <section className="space-y-5"><div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Revisa tu cita</p><h3 className="mt-3 text-xl font-semibold">{fecha(fechaClinica(new Date(turno.inicio)))}</h3><p className="mt-2 text-2xl font-semibold">{hora(turno.inicio)} – {hora(turno.fin)}</p><p className="mt-4 text-sm font-semibold">{elegido?.nombre}</p><p className="mt-1 text-sm text-slate-500">{elegido?.especialidad} · {elegido?.clinica}</p></div><label className="block text-sm font-medium">Motivo de consulta <span className="font-normal text-slate-500">(opcional)</span><textarea disabled={ocupado} maxLength={1000} value={motivo} onChange={e => { setMotivo(e.target.value); clave.current = crypto.randomUUID() }} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" rows={3} placeholder="Cuéntale brevemente al médico el motivo de tu visita." /></label><p className="text-xs leading-relaxed text-slate-500">Al confirmar se reserva este horario y se avisa al médico y a recepción. Podrás reagendar con más de 2 horas de anticipación.</p><div className="flex flex-wrap justify-between gap-3"><button type="button" disabled={ocupado} className={BOTON_SECUNDARIO} onClick={() => { setTurno(null); clave.current = crypto.randomUUID() }}>Elegir otro horario</button><button type="button" disabled={ocupado} className={BOTON_PRIMARIO} onClick={() => { void guardar() }}><Check size={17} />{ocupado ? 'Confirmando...' : 'Confirmar y agendar'}</button></div></section> : <>
      <label className="block text-sm font-medium">Médico<select aria-label="Médico" disabled={ocupado || !datos || medicoFijo} value={medico} onChange={e => setMedico(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">Selecciona a tu médico</option>{datos?.medicos.map(m => <option key={m.id} value={m.id}>{m.nombre} · {m.especialidad}{!m.publicado ? ' · Horario no publicado' : ''}</option>)}</select></label>
      {datos && !datos.medicos.length && <p className="text-sm text-slate-500">No hay médicos disponibles para reserva. Contacta con recepción.</p>}
      {medico && <section className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><button type="button" aria-label="Semana anterior" disabled={consultando || desde <= fechaClinica()} className={BOTON_SECUNDARIO} onClick={() => setDesde(sumarDias(desde, -7) < fechaClinica() ? fechaClinica() : sumarDias(desde, -7))}><ChevronLeft size={16} /></button><p className="text-center text-xs text-slate-600">{fecha(desde)} — {fecha(sumarDias(desde, 6))}</p><button type="button" aria-label="Semana siguiente" disabled={consultando || desde >= sumarDias(fechaClinica(), 56)} className={BOTON_SECUNDARIO} onClick={() => setDesde(sumarDias(desde, 7))}><ChevronRight size={16} /></button></div>
        {consultando && <p role="status" className="mt-4 text-sm text-slate-500">Consultando horarios disponibles...</p>}
        {agenda && !agenda.turnos.length && <p className="mt-4 text-sm text-slate-500">{agenda.motivo || 'No hay horarios libres en esta semana. Revisa la siguiente.'}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{dias.map(d => <button type="button" key={d} aria-pressed={dia === d} onClick={() => setDia(d)} className={`rounded-xl border px-3 py-2 text-xs ${dia === d ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white'}`}>{fecha(d)}</button>)}</div>
        <div className="mt-4 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">{agenda?.turnos.filter(t => fechaClinica(new Date(t.inicio)) === dia).map(t => <button type="button" key={t.inicio} className="rounded-xl border border-blue-100 px-3 py-3 text-sm font-medium text-blue-800 hover:bg-blue-50" onClick={() => { clave.current = crypto.randomUUID(); setTurno(t) }}><CalendarDays size={15} className="mr-2 inline" />{hora(t.inicio)} – {hora(t.fin)}</button>)}</div>
      </section>}
    </>}
  </ModalMarco>
}
