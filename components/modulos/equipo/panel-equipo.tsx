'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BellRing, CheckCheck, MessageSquare, Plus, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { ModalMarco } from '../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO } from '../compartidos/editor-clinico'

type Persona = { id: number; nombre: string; rol: string }
type Mensaje = { id: string; autor: number; responsable: string; contenido: string; creado_en: string }
type Conversacion = { id: string; iniciador_id: number; destinatario_id: number; iniciador: string; destinatario: string; ambito: string; asunto: string; paciente: string | null; urgente: boolean; actualizado_en: string; sin_leer: number; mensajes: Mensaje[] }
type Datos = { usuarioId: number; destinatarios: Persona[]; pacientes: { id: number; nombre: string }[]; conversaciones: Conversacion[] }
export type NuevoMensajeEquipo = { rolDestino?: string; asunto?: string; contenido?: string; pacienteId?: number; urgente?: boolean }
const roles: Record<string, string> = { admin: 'Administración', medico: 'Médico', enfermero: 'Enfermería', recepcionista: 'Recepción' }
const fecha = (s: string) => new Date(s).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' })
async function operar(accion: string, datos: object, clave: string) {
  const r = await fetch('/api/equipo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, datos, clave }) }), b = await r.json()
  if (!r.ok) throw Error(b.error || 'No se pudo guardar el mensaje.')
  return b as { id: string }
}

function NuevoMensaje({ datos, rol, inicial, onClose, onEnviado }: { datos: Datos; rol: string; inicial?: NuevoMensajeEquipo; onClose: () => void; onEnviado: (id: string) => void }) {
  const [destino, setDestino] = useState(String(datos.destinatarios.find(d => d.rol === inicial?.rolDestino)?.id ?? ''))
  const [paciente, setPaciente] = useState(String(inicial?.pacienteId ?? '')), [asunto, setAsunto] = useState(inicial?.asunto ?? ''), [contenido, setContenido] = useState(inicial?.contenido ?? ''), [urgente, setUrgente] = useState(inicial?.urgente ?? false)
  const [ambito, setAmbito] = useState(inicial?.pacienteId && inicial.rolDestino === 'medico' ? 'clinico' : 'administrativo'), [error, setError] = useState<string | null>(null), [ocupado, setOcupado] = useState(false)
  const clave = useRef(crypto.randomUUID()), enviando = useRef(false)
  const receptor = datos.destinatarios.find(d => d.id === Number(destino)), soloOperativo = rol === 'recepcionista' || receptor?.rol === 'recepcionista'
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); if (enviando.current) return
    enviando.current = true; setOcupado(true); setError(null)
    try { const r = await operar('enviar', { destinatario: Number(destino), pacienteId: paciente ? Number(paciente) : null, ambito: soloOperativo ? 'administrativo' : ambito, asunto, contenido, urgente }, clave.current); onEnviado(r.id) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar. Tus datos se conservan para reintentar.') }
    finally { enviando.current = false; setOcupado(false) }
  }
  return <ModalMarco title="Nuevo mensaje al equipo" ancho="max-w-2xl" contenidoFijo onClose={() => { if (!ocupado) onClose() }} footer={<div className="flex justify-between gap-3"><button type="button" className={BOTON_SECUNDARIO} disabled={ocupado} onClick={onClose}>Cancelar</button><button type="submit" form="nuevo-mensaje-equipo" className={BOTON_PRIMARIO} disabled={ocupado}><Send size={16} />{ocupado ? 'Enviando...' : 'Enviar mensaje'}</button></div>}>
    <AvisoClinico mensaje={error} />
    <form id="nuevo-mensaje-equipo" onSubmit={enviar}><fieldset disabled={ocupado} className="space-y-4">
      <label className="block text-sm font-medium">Destinatario<select required className={CAMPO_CLINICO} value={destino} onChange={e => setDestino(e.target.value)}><option value="">Selecciona a quién comunicarte</option>{Object.entries(roles).map(([r, etiqueta]) => <optgroup key={r} label={etiqueta}>{datos.destinatarios.filter(d => d.rol === r).map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</optgroup>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Tipo de comunicación<select className={CAMPO_CLINICO} value={soloOperativo ? 'administrativo' : ambito} onChange={e => setAmbito(e.target.value)} disabled={soloOperativo}><option value="administrativo">Coordinación operativa</option><option value="clinico">Seguimiento clínico</option></select></label><label className="block text-sm font-medium">Paciente relacionado<select required={!soloOperativo && ambito === 'clinico'} className={CAMPO_CLINICO} value={paciente} onChange={e => setPaciente(e.target.value)}><option value="">Sin paciente / coordinación general</option>{datos.pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label></div>
      <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{soloOperativo ? 'Recepción recibe únicamente coordinación operativa: llegadas, citas, ubicación o solicitudes. No incluyas diagnósticos ni indicaciones clínicas.' : 'Los mensajes clínicos solo están disponibles mientras ambos profesionales tengan acceso al paciente. Para una urgencia, utiliza también el protocolo presencial de la clínica.'}</p>
      <label className="block text-sm font-medium">Asunto<input required minLength={3} maxLength={120} className={CAMPO_CLINICO} value={asunto} onChange={e => setAsunto(e.target.value)} /></label>
      <label className="block text-sm font-medium">Mensaje<textarea required maxLength={3000} rows={5} className={CAMPO_CLINICO} value={contenido} onChange={e => setContenido(e.target.value)} /></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)} />Marcar como prioritario para el equipo</label>
    </fieldset></form>
  </ModalMarco>
}

export function PanelEquipo({ rol, inicial }: { rol: string; inicial?: NuevoMensajeEquipo }) {
  const [datos, setDatos] = useState<Datos | null>(null), [error, setError] = useState<string | null>(null), [cargando, setCargando] = useState(false), [seleccion, setSeleccion] = useState<string | null>(null), [nuevo, setNuevo] = useState(Boolean(inicial)), [busqueda, setBusqueda] = useState(''), [respuesta, setRespuesta] = useState(''), [enviando, setEnviando] = useState(false), [aviso, setAviso] = useState('')
  const clave = useRef(crypto.randomUUID()), ocupado = useRef(false), vigente = useRef(true)
  const cargar = useCallback(async (signal?: AbortSignal) => {
    setCargando(true)
    try { const r = await fetch('/api/equipo', { cache: 'no-store', signal }), b = await r.json(); if (!r.ok) throw Error(b.error); if (!signal?.aborted && vigente.current) { setDatos(b); setError(null) } }
    catch (e) { if (!signal?.aborted && vigente.current) setError(e instanceof Error ? e.message : 'No se pudo consultar la bandeja del equipo.') }
    finally { if (!signal?.aborted && vigente.current) setCargando(false) }
  }, [])
  useEffect(() => { vigente.current = true; const c = new AbortController(), actualizar = () => { void cargar(c.signal) }; actualizar(); const t = window.setInterval(actualizar, 20000); window.addEventListener('notificaciones-nuevas', actualizar); window.addEventListener('focus', actualizar); return () => { vigente.current = false; c.abort(); clearInterval(t); window.removeEventListener('notificaciones-nuevas', actualizar); window.removeEventListener('focus', actualizar) } }, [cargar])
  const conversacion = datos?.conversaciones.find(c => c.id === seleccion), conversaciones = (datos?.conversaciones ?? []).filter(c => `${c.asunto} ${c.iniciador} ${c.destinatario} ${c.paciente ?? ''}`.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es')))
  async function abrir(c: Conversacion) {
    if (enviando) return
    setSeleccion(c.id); setRespuesta(''); clave.current = crypto.randomUUID(); setAviso('')
    try { await operar('leer', { id: c.id }, crypto.randomUUID()); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo marcar el mensaje como leído.') }
  }
  async function responder(e: React.FormEvent) {
    e.preventDefault(); if (!conversacion || ocupado.current) return
    ocupado.current = true; setEnviando(true); setError(null)
    try { await operar('responder', { id: conversacion.id, contenido: respuesta }, clave.current); setRespuesta(''); clave.current = crypto.randomUUID(); setAviso('Respuesta enviada al equipo.'); window.dispatchEvent(new Event('datos-actualizados')); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar. La respuesta se conserva para reintentar.') }
    finally { ocupado.current = false; setEnviando(false) }
  }
  return <section className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Coordinación de la atención</p><h2 className="mt-2 text-3xl font-semibold">Comunicación del equipo</h2><p className="mt-2 text-sm text-slate-500">Contacta con recepción, médicos y enfermería; consulta las respuestas en una misma conversación.</p></div><div className="flex gap-2"><button type="button" disabled={cargando} className={BOTON_SECUNDARIO} onClick={() => void cargar()}><RefreshCw size={16} />Actualizar</button><button type="button" disabled={!datos} className={BOTON_PRIMARIO} onClick={() => setNuevo(true)}><Plus size={16} />Nuevo mensaje</button></div></header>
    <AvisoClinico mensaje={error} />{aviso && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{aviso}</p>}
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><ShieldCheck size={19} className="shrink-0 text-teal-700" /><p>Solo los participantes autorizados ven cada conversación. Los mensajes de recepción son operativos; la atención clínica permanece en su expediente.</p></div>
    {datos && <div className="grid min-w-0 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"><aside aria-label="Conversaciones del equipo" className={`${seleccion ? 'hidden lg:block' : ''} min-w-0 rounded-2xl border border-slate-200 bg-white p-4`}><label className="block text-xs font-medium text-slate-600">Buscar conversación<input type="search" className={CAMPO_CLINICO} value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Persona, asunto o paciente" /></label><p className="my-4 text-xs text-slate-500">{datos.conversaciones.reduce((n, c) => n + Number(c.sin_leer), 0)} mensajes sin leer · Últimas 100 conversaciones</p><div className="max-h-[580px] space-y-2 overflow-y-auto">{!conversaciones.length && <p className="py-6 text-sm text-slate-500">Todavía no hay conversaciones. Puedes iniciar una con Nuevo mensaje.</p>}{conversaciones.map(c => <button type="button" disabled={enviando} key={c.id} onClick={() => void abrir(c)} aria-pressed={seleccion === c.id} className={`w-full rounded-xl border p-3 text-left ${seleccion === c.id ? 'border-teal-400 bg-teal-50' : 'border-slate-100 hover:bg-slate-50'}`}><div className="flex justify-between gap-3"><span className="text-sm font-semibold">{c.iniciador_id === datos.usuarioId ? c.destinatario : c.iniciador}</span>{Number(c.sin_leer) > 0 && <span className="rounded-full bg-teal-700 px-2 py-0.5 text-xs text-white">{c.sin_leer}</span>}</div><p className="mt-1 truncate text-sm text-slate-600">{c.urgente && 'Prioritario · '}{c.asunto}</p><time className="mt-2 block text-xs text-slate-400">{fecha(c.actualizado_en)}</time></button>)}</div></aside>
      <section aria-label="Detalle de conversación" className={`${!seleccion ? 'hidden lg:flex' : 'flex'} min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6`}>{!conversacion ? <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center text-slate-500"><MessageSquare size={32} /><p>Selecciona una conversación o escribe un nuevo mensaje.</p>{seleccion && <button className={BOTON_SECUNDARIO} onClick={() => setSeleccion(null)}>Volver a la bandeja</button>}</div> : <><header className="border-b border-slate-100 pb-4"><button type="button" className="mb-3 flex items-center gap-2 text-sm text-teal-700 lg:hidden" onClick={() => setSeleccion(null)}><ArrowLeft size={15} />Volver a conversaciones</button><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{conversacion.asunto}</h3>{conversacion.urgente && <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800"><BellRing size={12} />Prioritario</span>}</div><p className="mt-2 text-xs text-slate-500">{conversacion.iniciador} ↔ {conversacion.destinatario} · {conversacion.ambito === 'clinico' ? 'Seguimiento clínico' : 'Coordinación operativa'}{conversacion.paciente && ` · ${conversacion.paciente}`}</p></header>
        <ol aria-label="Mensajes de la conversación" className="my-5 max-h-[420px] space-y-4 overflow-y-auto">{conversacion.mensajes.map(m => <li key={m.id} className={`max-w-[94%] rounded-xl p-4 ${m.autor === datos.usuarioId ? 'ml-auto bg-teal-50' : 'mr-auto bg-slate-50'}`}><p className="text-xs font-semibold text-slate-700">{m.responsable}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{m.contenido}</p><time className="mt-3 block text-xs text-slate-400">{fecha(m.creado_en)}</time></li>)}</ol>
        <form onSubmit={responder} className="mt-auto border-t border-slate-100 pt-4"><label className="block text-sm font-medium">Tu respuesta<textarea required maxLength={3000} rows={3} disabled={enviando} value={respuesta} onChange={e => { setRespuesta(e.target.value); clave.current = crypto.randomUUID() }} className={CAMPO_CLINICO} /></label><div className="mt-3 flex items-center justify-between gap-3"><span className="flex items-center gap-1 text-xs text-slate-400"><CheckCheck size={14} />La respuesta queda guardada</span><button type="submit" disabled={enviando || !respuesta.trim()} className={BOTON_PRIMARIO}><Send size={15} />{enviando ? 'Enviando...' : 'Enviar respuesta'}</button></div></form></>}
      </section></div>}
    {nuevo && datos && <NuevoMensaje datos={datos} rol={rol} inicial={inicial} onClose={() => setNuevo(false)} onEnviado={id => { setNuevo(false); setSeleccion(id); setAviso('Mensaje enviado. El destinatario recibirá una notificación.'); window.dispatchEvent(new Event('datos-actualizados')); void cargar() }} />}
  </section>
}
