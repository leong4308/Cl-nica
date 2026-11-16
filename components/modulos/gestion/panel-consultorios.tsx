'use client'
import { useState } from 'react'
import { Building2, CalendarDays, ChevronLeft, ChevronRight, Info, List, MapPin, Pencil, Plus, RefreshCw, Stethoscope } from 'lucide-react'
import { fechaClinica, sumarDias } from '@/lib/agenda/modelo'
import { agruparFranjasConsultorio, franjasEnFecha, type TurnoConsultorio as Turno } from '@/lib/gestion/consultorios'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '../compartidos/editor-clinico'
import { ModalMarco } from '../compartidos/modal-marco'
import { usarGestion } from './usar-gestion'
import { AvisosGestion, diaLegible } from './comunes'

type Sala = { id: number; clinicaId: number; nombre: string; ubicacion: string; activo: boolean; version: string }
type Datos = { clinicas: { id: number; nombre: string }[]; medicos: { id: number; nombre: string; clinicaId: number; asignado: boolean }[]; salas: Sala[]; turnos: Turno[] }
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const SEMANA = [1, 2, 3, 4, 5, 6, 0]
const CONTROL = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const estadoTurno = (t: Turno, fecha: string) => !t.activo ? 'Desactivada' : t.desde > fecha ? 'Programada' : t.hasta < fecha ? 'Finalizada' : 'Vigente'

export function PanelConsultorios({ rol }: { rol: string }) {
  const g = usarGestion<Datos>('consultorios'), d = g.datos, admin = rol === 'admin', hoy = fechaClinica()
  const [form, setForm] = useState<Record<string, string> | null>(null), [clinica, setClinica] = useState('')
  const [fecha, setFecha] = useState(hoy), [ayuda, setAyuda] = useState(false)
  const [baja, setBaja] = useState<Turno | null>(null), [detalle, setDetalle] = useState<Sala | null>(null), [pagina, setPagina] = useState(0)
  const [medicos, setMedicos] = useState<Record<number, number>>({}), [movil, setMovil] = useState<number | null>(null)
  const cambiar = (k: string, v: string) => setForm(f => f ? { ...f, [k]: v } : f)
  const salas = d?.salas.filter(s => !clinica || s.clinicaId === Number(clinica)) ?? []
  const salaMovil = salas.some(s => s.id === movil) ? movil : salas[0]?.id
  const sinAsignacion = d?.medicos.filter(m => !m.asignado && (!clinica || m.clinicaId === Number(clinica))) ?? []
  function abrir(accion: string, s?: Sala) {
    setForm({ accion, id: String(s?.id ?? ''), version: s?.version ?? '', clinicaId: String(s?.clinicaId ?? d?.clinicas[0]?.id ?? ''), nombre: s?.nombre ?? '', ubicacion: s?.ubicacion ?? '', activo: String(s?.activo ?? true), consultorioId: String(s?.id ?? d?.salas.find(x => x.activo)?.id ?? ''), medicoId: '', dia: String(new Date(hoy + 'T12:00:00Z').getUTCDay()), desde: hoy, hasta: sumarDias(hoy, 30), inicio: '08:00', fin: '20:00' })
    g.setError('')
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (!form) return
    const datos = form.accion === 'turno' ? { consultorioId: Number(form.consultorioId), medicoId: Number(form.medicoId), dia: Number(form.dia), desde: form.desde, hasta: form.hasta, inicio: form.inicio, fin: form.fin } : form.accion === 'sala' ? { clinicaId: Number(form.clinicaId), nombre: form.nombre, ubicacion: form.ubicacion } : { id: Number(form.id), version: form.version, nombre: form.nombre, ubicacion: form.ubicacion, activo: form.activo === 'true' }
    if (await g.guardar(form.accion, datos)) setForm(null)
  }
  const seleccionada = d?.salas.find(s => s.id === Number(form?.consultorioId))
  const tituloForm = form?.accion === 'turno' ? 'Asignar espacio y horario' : form?.accion === 'sala' ? 'Nuevo consultorio' : 'Editar consultorio'
  const turnosDetalle = d?.turnos.filter(t => t.consultorioId === detalle?.id).sort((a, b) => {
    const orden = (t: Turno) => !t.activo ? 3 : t.hasta < fecha ? 2 : t.desde > fecha ? 1 : 0
    return orden(a) - orden(b) || a.desde.localeCompare(b.desde) || SEMANA.indexOf(a.dia) - SEMANA.indexOf(b.dia) || a.inicio.localeCompare(b.inicio)
  }) ?? []
  const totalPaginas = Math.max(1, Math.ceil(turnosDetalle.length / 8)), paginaActual = Math.min(pagina, totalPaginas - 1)

  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Espacios de atención</p><h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Consultorios</h2><p className="mt-1 text-sm text-slate-500">Cada médico, su espacio y su horario de un vistazo.</p></div>
      <div className="flex flex-wrap gap-2"><button disabled={g.cargando} className={BOTON_SECUNDARIO} onClick={() => void g.cargar()}><RefreshCw size={16} />Actualizar</button>{admin && <><button disabled={!d?.salas.some(s => s.activo) || g.guardando} className={BOTON_SECUNDARIO} onClick={() => abrir('turno')}>Asignar consultorio</button><button disabled={!d || g.guardando} className={BOTON_PRIMARIO} onClick={() => abrir('sala')}><Plus size={16} />Crear consultorio</button></>}</div>
    </header>
    <AvisosGestion error={!form && !baja ? g.error : ''} mensaje={g.mensaje} />
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium text-slate-500">Filtrar clínica<select className={CONTROL + ' w-full min-w-0 sm:min-w-52'} value={clinica} onChange={e => setClinica(e.target.value)}><option value="">Todas las clínicas</option>{d?.clinicas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium text-slate-500">Consultar fecha<input type="date" className={CONTROL} value={fecha} onChange={e => setFecha(e.target.value || hoy)} /></label>
        {fecha !== hoy && <button className={CONTROL} onClick={() => setFecha(hoy)}>Volver a hoy</button>}
        <label className="grid w-full gap-1 text-xs font-medium text-slate-500 md:hidden">Ver consultorio<select className={CONTROL} value={salaMovil ?? ''} onChange={e => setMovil(Number(e.target.value))}>{salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
        <button aria-expanded={ayuda} aria-controls="ayuda-consultorios" className={CONTROL + ' inline-flex items-center gap-2'} onClick={() => setAyuda(!ayuda)}><Info size={16} />Cómo funciona</button>
      </div>
      {ayuda && <p id="ayuda-consultorios" className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">La vista semanal muestra las asignaciones que cubren la fecha consultada. Las renovaciones consecutivas del mismo horario se agrupan. Para revisar cada periodo, abre «Ver asignaciones». Las reservas respetan también la agenda y los descansos del médico; los médicos sin asignaciones conservan su agenda publicada.</p>}
    </div>
    {!!sinAsignacion.length && <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">Sin asignación vigente: {sinAsignacion.map(m => m.nombre).join(', ')}.</p>}
    <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      {salas.map(s => {
        const turnos = d?.turnos.filter(t => t.consultorioId === s.id) ?? [], franjas = agruparFranjasConsultorio(turnos)
        const opciones = [...new Map(franjas.map(t => [t.medicoId, { id: t.medicoId, nombre: t.medico }])).values()]
        const preferido = opciones.find(m => franjasEnFecha(franjas, m.id, fecha).length)?.id ?? opciones[0]?.id
        const medicoId = opciones.some(m => m.id === medicos[s.id]) ? medicos[s.id] : preferido
        const nombre = opciones.find(m => m.id === medicoId)?.nombre, horario = franjasEnFecha(franjas, medicoId ?? 0, fecha)
        const hasta = horario.map(t => t.hasta).sort()[0], diaSeleccionado = new Date(fecha + 'T12:00:00Z').getUTCDay()
        return <section key={s.id} aria-labelledby={'consultorio-' + s.id} className={'min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ' + (s.id === salaMovil ? 'flex' : 'hidden md:flex')}>
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Building2 size={21} /></span><div className="min-w-0"><h3 id={'consultorio-' + s.id} className="text-lg font-semibold text-slate-950">{s.nombre}</h3><p className="truncate text-xs text-slate-500" title={d?.clinicas.find(c => c.id === s.clinicaId)?.nombre}>{d?.clinicas.find(c => c.id === s.clinicaId)?.nombre}</p></div></div>
            <span className={'shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ' + (s.activo ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600')}>{s.activo ? 'Activo' : 'Fuera de servicio'}</span>
          </div>
          <div className="px-5 pt-3"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Stethoscope size={17} className="shrink-0 text-blue-600" />{opciones.length > 1 ? <label className="min-w-0 flex-1"><span className="sr-only">Médico en {s.nombre}</span><select className={CONTROL + ' w-full'} value={medicoId} onChange={e => setMedicos(m => ({ ...m, [s.id]: Number(e.target.value) }))}>{opciones.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label> : <p>{nombre ?? 'Sin médico asignado'}</p>}</div><p className="mt-1 text-xs text-slate-500">{horario.length ? 'Horario semanal para la fecha consultada' : 'Sin horario asignado para esta fecha'}</p>{s.ubicacion && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} className="shrink-0" />{s.ubicacion}</p>}</div>
          <div className="flex-1 px-5 py-2"><table className="w-full text-left text-sm" aria-label={'Horario semanal de ' + s.nombre}><thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400"><th className="pb-2 font-medium">Día</th><th className="pb-2 text-right font-medium">Horario</th></tr></thead><tbody>{SEMANA.map(dia => {
            const bloques = horario.filter(t => t.dia === dia), marcado = dia === diaSeleccionado
            return <tr key={dia} className={'border-b border-slate-100 last:border-0 ' + (marcado ? 'bg-blue-50/70' : '')}><th className={'rounded-l-lg py-2 pl-2 pr-1 font-medium ' + (marcado ? 'text-blue-700' : 'text-slate-600')}>{DIAS[dia]}{marcado && fecha === hoy && <span className="ml-1.5 text-[10px] font-normal">Hoy</span>}</th><td className="rounded-r-lg py-2 pl-1 pr-2 text-right tabular-nums">{bloques.length ? bloques.map(t => <span className="block whitespace-nowrap text-xs font-medium text-slate-800" key={t.inicio + t.fin}>{t.inicio.slice(0, 5)} – {t.fin.slice(0, 5)}</span>) : <span className="text-xs text-slate-400">Sin horario</span>}</td></tr>
          })}</tbody></table></div>
          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3"><p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} className="shrink-0" />{hasta ? <>Asignación hasta <strong className="font-medium text-slate-700">{diaLegible(hasta)}</strong></> : 'Revisa los periodos de asignación'}</p><div className="mt-3 flex items-center justify-between gap-2"><button className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900" onClick={() => { setDetalle(s); setPagina(0); g.setError('') }}><List size={15} />Ver asignaciones</button>{admin && <button aria-label={'Editar ' + s.nombre} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-950" disabled={g.guardando} onClick={() => abrir('editar_sala', s)}><Pencil size={14} />Editar</button>}</div></div>
        </section>
      })}
    </div>
    {!salas.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center"><Building2 size={28} className="mx-auto text-slate-300" /><p className="mt-3 text-sm text-slate-500">{g.cargando ? 'Consultando consultorios…' : 'No hay consultorios para este filtro. Administración puede registrar los espacios reales de la clínica.'}</p></div>}

    {form && <ModalMarco title={tituloForm} ancho="max-w-2xl" contenidoFijo onClose={() => { if (!g.guardando) setForm(null) }} footer={<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={g.guardando} className={BOTON_SECUNDARIO} onClick={() => setForm(null)}>Cancelar edición</button><button type="submit" form="form-consultorio" disabled={g.guardando} className={BOTON_PRIMARIO}>Guardar consultorio o asignación</button></div>}>
      <AvisosGestion error={g.error} mensaje="" /><form id="form-consultorio" onSubmit={guardar}><fieldset disabled={g.guardando} className="mt-3 grid gap-4 md:grid-cols-2">
        {form.accion === 'turno' ? <><label className={ETIQUETA_CLINICA}>Consultorio<select required className={CAMPO_CLINICO} value={form.consultorioId} onChange={e => { cambiar('consultorioId', e.target.value); cambiar('medicoId', '') }}><option value="">Selecciona</option>{d?.salas.filter(s => s.activo).map(s => <option key={s.id} value={s.id}>{s.nombre} · {d.clinicas.find(c => c.id === s.clinicaId)?.nombre}</option>)}</select></label><label className={ETIQUETA_CLINICA}>Médico<select required className={CAMPO_CLINICO} value={form.medicoId} onChange={e => cambiar('medicoId', e.target.value)}><option value="">Selecciona un médico</option>{d?.medicos.filter(m => m.clinicaId === seleccionada?.clinicaId).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label><label className={ETIQUETA_CLINICA}>Día de la semana<select className={CAMPO_CLINICO} value={form.dia} onChange={e => cambiar('dia', e.target.value)}>{DIAS.map((t, i) => <option key={t} value={i}>{t}</option>)}</select></label><div /><label className={ETIQUETA_CLINICA}>Vigente desde<input required type="date" min={hoy} max={form.hasta} className={CAMPO_CLINICO} value={form.desde} onChange={e => cambiar('desde', e.target.value)} /></label><label className={ETIQUETA_CLINICA}>Vigente hasta<input required type="date" min={form.desde} max={sumarDias(hoy, 366)} className={CAMPO_CLINICO} value={form.hasta} onChange={e => cambiar('hasta', e.target.value)} /></label><label className={ETIQUETA_CLINICA}>Hora de inicio<input required type="time" className={CAMPO_CLINICO} value={form.inicio} onChange={e => cambiar('inicio', e.target.value)} /></label><label className={ETIQUETA_CLINICA}>Hora de término<input required type="time" className={CAMPO_CLINICO} value={form.fin} onChange={e => cambiar('fin', e.target.value)} /></label></> : <>{form.accion === 'sala' && <label className={ETIQUETA_CLINICA}>Clínica<select required className={CAMPO_CLINICO} value={form.clinicaId} onChange={e => cambiar('clinicaId', e.target.value)}><option value="">Selecciona</option>{d?.clinicas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>}<label className={ETIQUETA_CLINICA}>Nombre del consultorio<input required maxLength={80} className={CAMPO_CLINICO} value={form.nombre} onChange={e => cambiar('nombre', e.target.value)} placeholder="Ej. Consultorio 201" /></label><label className={ETIQUETA_CLINICA}>Ubicación<input maxLength={200} className={CAMPO_CLINICO} value={form.ubicacion} onChange={e => cambiar('ubicacion', e.target.value)} placeholder="Piso, torre o indicación para encontrarlo" /></label>{form.accion === 'editar_sala' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo === 'true'} onChange={e => cambiar('activo', String(e.target.checked))} />Consultorio activo</label>}</>}
      </fieldset></form>
    </ModalMarco>}

    {detalle && <ModalMarco title={'Asignaciones · ' + detalle.nombre} ancho="max-w-4xl" contenidoFijo onClose={() => setDetalle(null)} footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{turnosDetalle.length} asignaciones · Página {paginaActual + 1} de {totalPaginas}</p><div className="flex gap-2"><button aria-label="Página anterior de asignaciones" className={BOTON_SECUNDARIO} disabled={paginaActual === 0} onClick={() => setPagina(paginaActual - 1)}><ChevronLeft size={16} /></button><button aria-label="Página siguiente de asignaciones" className={BOTON_SECUNDARIO} disabled={paginaActual + 1 >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}><ChevronRight size={16} /></button><button className={BOTON_SECUNDARIO} onClick={() => setDetalle(null)}>Cerrar detalle</button></div></div>}>
      <p className="mb-4 text-sm text-slate-500">Periodos originales y renovaciones. La vista principal agrupa los horarios que continúan sin interrupciones.</p><div className="space-y-2">{turnosDetalle.slice(paginaActual * 8, paginaActual * 8 + 8).map(t => <article key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"><div><p className="text-sm font-semibold text-slate-800">{t.medico}</p><p className="mt-1 text-xs text-slate-600">{DIAS[t.dia]} · {t.inicio.slice(0, 5)} – {t.fin.slice(0, 5)}</p><p className="mt-1 text-xs text-slate-500">{diaLegible(t.desde)} al {diaLegible(t.hasta)}</p></div><div className="flex items-center gap-3"><span className={'rounded-full px-2 py-1 text-xs ' + (estadoTurno(t, hoy) === 'Vigente' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600')}>{estadoTurno(t, hoy)}</span>{admin && t.activo && <button aria-label={'Desactivar asignación de ' + t.medico + ', ' + DIAS[t.dia] + ' ' + t.inicio.slice(0, 5)} disabled={g.guardando} className="text-xs font-medium text-rose-700" onClick={() => { setDetalle(null); setBaja(t); g.setError('') }}>Desactivar</button>}</div></article>)}{!turnosDetalle.length && <p className="py-5 text-center text-sm text-slate-500">Sin asignaciones registradas.</p>}</div>
    </ModalMarco>}

    {baja && <ModalMarco title="Desactivar asignación" ancho="max-w-lg" contenidoFijo onClose={() => { if (!g.guardando) setBaja(null) }} footer={<div className="flex flex-wrap justify-end gap-2"><button disabled={g.guardando} className={BOTON_SECUNDARIO} onClick={() => setBaja(null)}>Conservar asignación</button><button disabled={g.guardando} className={BOTON_PRIMARIO} onClick={async () => { if (await g.guardar('baja_turno', { id: baja.id, version: baja.version })) setBaja(null) }}>Confirmar desactivación</button></div>}><AvisosGestion error={g.error} mensaje="" /><p className="text-sm font-semibold">{baja.medico}</p><p className="mt-2 text-sm text-slate-600">{DIAS[baja.dia]} · {baja.inicio.slice(0, 5)} – {baja.fin.slice(0, 5)}</p><p className="mt-3 text-sm leading-relaxed text-slate-500">No se permitirá si hay citas vigentes que dependan de ella. Las citas no se cancelan automáticamente.</p></ModalMarco>}
  </div>
}
