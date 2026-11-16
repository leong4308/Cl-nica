'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Armchair, CalendarDays, CheckCircle2, Clock3, Phone, Plus, RefreshCw, Search, UsersRound } from 'lucide-react'
import { fechaClinica, horaClinica } from '@/lib/agenda/modelo'
import { activa, etapaCita, esperaMinutos, estadoMedico, indicadores, puedeReagendar, type CitaRecepcion, type PanelRecepcion as DatosPanel } from '@/lib/recepcion/modelo'
import { SolicitudesCambio } from '@/components/modulos/citas/solicitudes-cambio'
import { ModalMarco } from '@/components/modulos/compartidos/modal-marco'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '@/components/modulos/compartidos/editor-clinico'

type Props = { seccion: string; nombre: string; openModal: (titulo: string) => void; navigate: (seccion: string) => void }
const caja = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'
type Operacion = { cita: CitaRecepcion; accion: string; motivo: string; clave: string }
export function PanelRecepcion({ seccion, nombre, openModal, navigate }: Props) {
  const [dia, setDia] = useState(fechaClinica)
  const [datos, setDatos] = useState<DatosPanel | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [medico, setMedico] = useState('')
  const [estado, setEstado] = useState('')
  const [ahora, setAhora] = useState(Date.now())
  const [actualizando, setActualizando] = useState(false)
  const [operacion, setOperacion] = useState<Operacion | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorOperacion, setErrorOperacion] = useState('')
  const [detalle, setDetalle] = useState<CitaRecepcion | null>(null)
  const [pagina, setPagina] = useState(1)
  const secuencia = useRef(0)
  const desfase = useRef(0)
  const cargar = useCallback(async () => {
    const peticion = ++secuencia.current
    setActualizando(true)
    try {
      const r = await fetch(`/api/recepcion?dia=${dia}`, { cache: 'no-store' })
      const b = await r.json()
      if (!r.ok) throw Error(b.error || 'No se pudo actualizar recepción.')
      if (peticion !== secuencia.current) return
      desfase.current = Date.parse(b.ahora) - Date.now()
      setAhora(Date.now() + desfase.current); setDatos(b); setError('')
    } catch (e) { if (peticion === secuencia.current) setError(e instanceof Error ? e.message : 'No se pudo conectar con recepción.') }
    finally { if (peticion === secuencia.current) setActualizando(false) }
  }, [dia])
  useEffect(() => {
    void cargar()
    const refrescar = () => { if (!document.hidden) void cargar() }
    const reloj = window.setInterval(() => { setAhora(Date.now() + desfase.current) }, 15000)
    const intervalo = window.setInterval(refrescar, 30000)
    window.addEventListener('datos-actualizados', refrescar); window.addEventListener('focus', refrescar)
    return () => { secuencia.current++; clearInterval(reloj); clearInterval(intervalo); window.removeEventListener('datos-actualizados', refrescar); window.removeEventListener('focus', refrescar) }
  }, [cargar])
  useEffect(() => { setPagina(1) }, [dia, busqueda, medico, estado, seccion])
  const citas = datos?.dia === dia ? datos.citas : []
  const resumen = indicadores(citas)
  const hoy = dia === fechaClinica(new Date(ahora))
  const filtradas = citas.filter(c => (!medico || c.medicoId === Number(medico)) && (!estado || etapaCita(c) === estado) && `${c.paciente} ${c.telefono ?? ''} ${c.medico} ${c.id}`.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')))
  const espera = filtradas.filter(c => activa(c) && c.llegada).sort((a, b) => Date.parse(a.llegada!) - Date.parse(b.llegada!))
  const lista = seccion === 'Sala de espera' ? espera : filtradas
  const paginas = Math.max(1, Math.ceil(lista.length / 20))
  const paginaActual = Math.min(pagina, paginas)
  const mostradas = lista.slice((paginaActual - 1) * 20, paginaActual * 20)
  const abrir = (cita: CitaRecepcion, accion: string) => { setErrorOperacion(''); setOperacion({ cita, accion, motivo: '', clave: crypto.randomUUID() }) }
  async function ejecutar(e: React.FormEvent) {
    e.preventDefault()
    if (!operacion || guardando) return
    setGuardando(true); setErrorOperacion('')
    try {
      const r = await fetch('/api/recepcion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId: operacion.cita.id, version: operacion.cita.version, accion: operacion.accion, motivo: operacion.motivo || null, clave: operacion.clave }) })
      const b = await r.json()
      if (!r.ok) throw Error(b.error || 'No se pudo registrar la acción.')
      setAviso(b.mensaje); setOperacion(null)
      window.dispatchEvent(new Event('datos-actualizados'))
    } catch (e) { setErrorOperacion(e instanceof Error ? e.message : 'No se pudo conectar. Puedes volver a intentar sin duplicar el registro.') }
    finally { setGuardando(false) }
  }
  const tituloOperacion = operacion?.accion === 'llegada' ? 'Registrar llegada' : operacion?.accion === 'confirmar' ? 'Confirmar cita' : operacion?.accion === 'cancelar' ? 'Cancelar cita' : 'Registrar inasistencia'
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Recepción · Atención al paciente</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{seccion === 'Resumen' ? `Hola, ${nombre}` : seccion === 'Citas' ? 'Agenda de recepción' : seccion}</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">{seccion === 'Sala de espera' ? 'Llegadas y tiempos de espera. El médico registra el inicio y el cierre de la consulta.' : 'Organiza las citas, recibe a los pacientes y coordina su atención con el equipo.'}</p></div><div className="flex flex-wrap gap-2"><button className={BOTON_SECUNDARIO} disabled={actualizando} onClick={() => void cargar()}><RefreshCw size={16} />Actualizar</button><button className={BOTON_PRIMARIO} onClick={() => openModal('Nueva cita')}><Plus size={16} />Agendar cita</button></div></header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error} {datos && 'Los datos anteriores se conservaron; actualiza antes de registrar cambios.'}</p>}
    {aviso && <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><span>{aviso}</span><button onClick={() => setAviso('')} aria-label="Cerrar aviso">×</button></div>}
    {seccion === 'Solicitudes' ? <SolicitudesCambio /> : <>
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4"><label className={ETIQUETA_CLINICA}>Fecha de la agenda<input type="date" className={CAMPO_CLINICO} value={dia} onChange={e => { if (e.target.value) setDia(e.target.value) }} /></label><button className={BOTON_SECUNDARIO} onClick={() => setDia(fechaClinica(new Date(ahora)))}>Hoy</button><p className="pb-3 text-xs text-slate-500">Horario de Ciudad de México · {datos?.dia === dia ? `Actualizado ${horaClinica(datos.ahora)}` : 'Sin datos para esta fecha'}</p></div>
      {seccion === 'Resumen' && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ icon: CalendarDays, titulo: 'Citas del día', numero: resumen.total, ayuda: 'Incluye cancelaciones e inasistencias' }, { icon: Armchair, titulo: 'En espera', numero: resumen.espera, ayuda: 'Llegaron y aún no inician consulta' }, { icon: UsersRound, titulo: 'En consulta', numero: resumen.consulta, ayuda: 'Atención iniciada por el médico' }, { icon: CheckCircle2, titulo: 'Finalizadas', numero: resumen.finalizadas, ayuda: 'Consultas concluidas' }].map(v => <article className={caja} key={v.titulo}><v.icon size={19} className="text-blue-600" /><p className="mt-4 text-sm font-medium text-slate-600">{v.titulo}</p><p className="mt-2 text-3xl font-semibold">{datos?.dia === dia ? v.numero : '—'}</p><p className="mt-2 text-xs text-slate-500">{v.ayuda}</p></article>)}</div><div className="flex flex-wrap gap-3"><button className={BOTON_SECUNDARIO} onClick={() => openModal('Registrar paciente')}><UsersRound size={16} />Registrar paciente</button><button className={BOTON_SECUNDARIO} onClick={() => navigate('Sala de espera')}><Armchair size={16} />Ver sala de espera</button><button className={BOTON_SECUNDARIO} onClick={() => navigate('Solicitudes')}>Atender solicitudes</button></div></>}
      {seccion === 'Médicos' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{datos?.medicos.map(m => <article key={m.id} className={caja}><p className="text-xs font-medium text-blue-700">{m.especialidad}</p><h3 className="mt-2 text-lg font-semibold">{m.nombre}</h3><span className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{estadoMedico(m, dia, ahora)}</span><p className="mt-4 text-xs text-slate-500">Jornada publicada para la fecha seleccionada</p><p className="mt-2 text-sm">{m.bloques?.filter(b => b.dia === new Date(dia + 'T12:00:00Z').getUTCDay()).map(b => `${b.inicio}–${b.fin}`).join(' · ') || 'Sin jornada publicada para este día'}</p><button className={BOTON_SECUNDARIO + ' mt-5'} onClick={() => { setMedico(String(m.id)); navigate('Citas') }}>Consultar citas</button></article>)}</div> : <section className={caja} aria-label={seccion === 'Sala de espera' ? 'Pacientes en espera' : 'Citas registradas'}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{seccion === 'Sala de espera' ? 'Seguimiento de llegadas' : 'Citas de la fecha seleccionada'}</h3><span className="text-xs text-slate-500">{resumen.pendientes} por iniciar · {resumen.canceladas} canceladas</span></div>
        <div className="my-5 grid gap-3 sm:grid-cols-3"><label className={ETIQUETA_CLINICA}>Buscar paciente<input className={CAMPO_CLINICO} placeholder="Nombre, teléfono o folio" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label><label className={ETIQUETA_CLINICA}>Médico<select className={CAMPO_CLINICO} value={medico} onChange={e => setMedico(e.target.value)}><option value="">Todos los médicos</option>{datos?.medicos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label><label className={ETIQUETA_CLINICA}>Estado<select className={CAMPO_CLINICO} value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos los estados</option>{['Pendiente', 'Confirmada', 'En espera', 'En consulta', 'Finalizada', 'Cancelada', 'No asistió'].map(e => <option key={e}>{e}</option>)}</select></label></div>
        <div className="space-y-3">{mostradas.map(c => <article key={c.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs text-slate-500">Cita #{c.id} · {horaClinica(c.inicio)}–{horaClinica(c.fin)}</p><h4 className="mt-2 font-semibold">{c.paciente}</h4><p className="mt-1 text-sm text-slate-500">{c.medico}{c.consultorio ? ` · ${c.consultorio}` : ''}</p>{c.telefono && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><Phone size={13} />{c.telefono}</p>}</div><div className="sm:text-right"><span className={'inline-block rounded-full px-3 py-1 text-xs font-medium ' + (etapaCita(c) === 'En espera' ? 'bg-amber-50 text-amber-800' : etapaCita(c) === 'En consulta' ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-700')}>{etapaCita(c)}</span>{c.llegada && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13} />Llegó {horaClinica(c.llegada)} · {esperaMinutos(c, ahora)} min de espera</p>}</div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><button className={BOTON_SECUNDARIO} onClick={() => setDetalle(c)}>Ver cita</button>{activa(c) && !c.enConsulta && <>
          {hoy && !c.llegada && <button disabled={!!error} className={BOTON_PRIMARIO} onClick={() => abrir(c, 'llegada')}>Registrar llegada</button>}
          {c.estado === 'pendiente' && <button disabled={!!error} className={BOTON_SECUNDARIO} onClick={() => abrir(c, 'confirmar')}>Confirmar</button>}
          {puedeReagendar(c, ahora) ? <button disabled={!!error} className={BOTON_SECUNDARIO} onClick={() => openModal(`Editar: ${c.id}`)}>Reagendar</button> : !c.llegada && <span className="self-center text-xs text-slate-500">Reagenda disponible con más de 2 h de anticipación.</span>}
          <button disabled={!!error} className={BOTON_SECUNDARIO + ' text-rose-700'} onClick={() => abrir(c, 'cancelar')}>Cancelar</button>
          {!c.llegada && Date.parse(c.fin) <= ahora && <button disabled={!!error} className={BOTON_SECUNDARIO} onClick={() => abrir(c, 'no_asistio')}>No asistió</button>}
        </>}</div></article>)}{!mostradas.length && <p className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">{datos?.dia !== dia ? error ? 'No fue posible consultar esta fecha.' : 'Consultando agenda…' : seccion === 'Sala de espera' ? 'No hay pacientes en espera ni en consulta para estos filtros.' : 'No hay citas para estos filtros.'}</p>}</div>
        {paginas > 1 && <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500"><span>Página {paginaActual} de {paginas}</span><div className="flex gap-2"><button className={BOTON_SECUNDARIO} disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>Anterior</button><button className={BOTON_SECUNDARIO} disabled={paginaActual === paginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente</button></div></div>}
      </section>}
      {seccion === 'Resumen' && <SolicitudesCambio />}
    </>}
    {operacion && <ModalMarco title={tituloOperacion} ancho="max-w-xl" onClose={() => { if (!guardando) setOperacion(null) }} footer={<div className="flex justify-end gap-3"><button disabled={guardando} className={BOTON_SECUNDARIO} onClick={() => setOperacion(null)}>Volver</button><button disabled={guardando} className={BOTON_PRIMARIO} type="submit" form="accion-recepcion">{guardando ? 'Guardando…' : tituloOperacion}</button></div>}><form id="accion-recepcion" onSubmit={ejecutar}><p className="font-semibold">{operacion.cita.paciente}</p><p className="mt-2 text-sm text-slate-500">Cita #{operacion.cita.id} · {operacion.cita.medico} · {horaClinica(operacion.cita.inicio)}</p>{operacion.accion === 'llegada' && <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Se avisará al médico y al personal de enfermería asignado. La consulta conservará su estado hasta que el médico la concluya.</p>}{['cancelar', 'no_asistio'].includes(operacion.accion) && <label className={ETIQUETA_CLINICA + ' mt-5 block'}>Motivo<textarea autoFocus required maxLength={1000} disabled={guardando} className={CAMPO_CLINICO} value={operacion.motivo} onChange={e => setOperacion({ ...operacion, motivo: e.target.value, clave: crypto.randomUUID() })} placeholder="Registra el motivo comunicado, sin datos clínicos." /></label>}{operacion.accion === 'cancelar' && <p className="mt-3 text-xs text-slate-500">Se liberará el horario y se notificará al paciente y al médico.</p>}{errorOperacion && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{errorOperacion}</p>}</form></ModalMarco>}
    {detalle && <ModalMarco title="Detalle de la cita" ancho="max-w-xl" onClose={() => setDetalle(null)} footer={<button className={BOTON_SECUNDARIO} onClick={() => setDetalle(null)}>Cerrar</button>}><p className="text-xl font-semibold">{detalle.paciente}</p><dl className="mt-5 space-y-4 text-sm">{[['Folio', `Cita #${detalle.id}`], ['Médico', detalle.medico], ['Horario', `${horaClinica(detalle.inicio)}–${horaClinica(detalle.fin)}`], ['Estado', etapaCita(detalle)], ['Motivo de la cita', detalle.motivo || 'No registrado'], ['Teléfono', detalle.telefono || 'No registrado']].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium">{v}</dd></div>)}</dl><button className={BOTON_SECUNDARIO + ' mt-6'} onClick={() => { setDetalle(null); openModal(`PacienteDetalle: ${detalle.pacienteId}`) }}>Ver datos del paciente</button></ModalMarco>}
  </div>
}

type Paciente = { id: number; esta_activo: boolean; usuarios: { nombre_completo: string; correo: string; telefono: string | null } }
export function DirectorioRecepcion({ openModal }: Pick<Props, 'openModal'>) {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')
  const [cargado, setCargado] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const cargar = async () => { try { const r = await fetch('/api/pacientes', { cache: 'no-store', signal: controller.signal }); const b = await r.json(); if (!r.ok) throw Error(b.error); if (!controller.signal.aborted) { setPacientes(b.pacientes); setError(''); setCargado(true) } } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo consultar el directorio.') } }
    void cargar(); window.addEventListener('datos-actualizados', cargar)
    return () => { controller.abort(); window.removeEventListener('datos-actualizados', cargar) }
  }, [])
  const filas = pacientes.filter(p => `${p.usuarios.nombre_completo} ${p.usuarios.correo} ${p.usuarios.telefono ?? ''} ${p.id}`.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es').trim()))
  return <div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Directorio administrativo</p><h2 className="mt-2 text-3xl font-semibold">Pacientes</h2><p className="mt-2 text-sm text-slate-500">Busca antes de registrar un paciente para evitar perfiles duplicados.</p></div><button className={BOTON_PRIMARIO} onClick={() => openModal('Registrar paciente')}><Plus size={16} />Registrar paciente</button></header>{error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}<section className={caja}><label className={ETIQUETA_CLINICA}><span className="flex items-center gap-2"><Search size={16} />Buscar paciente</span><input className={CAMPO_CLINICO} value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre, correo, teléfono o número de paciente" /></label><p className="my-4 text-xs text-slate-500">{filas.length} pacientes encontrados · Se muestran hasta 50; usa la búsqueda para localizar a alguien.</p><div className="divide-y divide-slate-100">{filas.slice(0, 50).map(p => <article key={p.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold">{p.usuarios.nombre_completo}</p><p className="mt-1 break-all text-xs text-slate-500">PAC-{String(p.id).padStart(5, '0')} · {p.usuarios.telefono || 'Sin teléfono'} · {p.usuarios.correo}</p><p className="mt-1 text-xs text-slate-500">{p.esta_activo ? 'Activo' : 'Inactivo'}</p></div><div className="flex gap-2"><button className={BOTON_SECUNDARIO} onClick={() => openModal(`PacienteDetalle: ${p.id}`)}>Ver datos</button><button className={BOTON_SECUNDARIO} onClick={() => openModal(`PacienteEditar: ${p.id}`)}>Editar datos</button></div></article>)}{!filas.length && <p className="py-10 text-center text-sm text-slate-500">{cargado ? 'No hay pacientes que coincidan.' : error ? 'El directorio no está disponible.' : 'Consultando directorio…'}</p>}</div></section></div>
}
