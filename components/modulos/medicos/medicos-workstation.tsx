'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, Plus, RefreshCw, Settings2, Stethoscope, UserRound } from 'lucide-react'
import type { ClinicActions } from '../compartidos/types'
import type { PerfilSesion } from '@/lib/supabase/sesion'
import type { MedicoPerfil, CitaAgendaMedico, MedicamentoPrescrito } from './types'
import type { NotaConsulta } from '@/lib/agenda/consulta'
import { obtenerMedicosBD, obtenerCitasAgendaMedico, finalizarConsultaYFirmar } from './datos-medicos'
import { fechaClinica, horaClinica, leerAgendaMedico, sumarDias, type ResumenAgenda } from '@/lib/agenda/modelo'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO } from '../compartidos/editor-clinico'
import { PacienteHeader } from './paciente-header'
import { SignosVitalesWidget } from './signos-vitales'
import { AntecedentesMedicamentos } from './antecedentes-medicamentos'
import { ConsultaSoap } from './consulta-soap'
import { PrescripcionReceta } from './prescripcion-receta'
import { DisponibilidadMedico } from './disponibilidad-medico'
import { ModalNuevaCita } from '../resumen/acciones-rapidas/nueva-cita/modal-nueva-cita'
import { ConfigurarHorario } from './configurar-horario'
import { DirectorioMedicos } from './directorio-medicos'

const vacio: NotaConsulta = { subjetivo: '', objetivo: '', diagnosticos: [], plan: '' }
const estadoTexto = { pendiente: 'Pendiente', confirmada: 'Confirmada', en_espera: 'En espera', atendida: 'Atendida', cancelada: 'Cancelada / No asistió' }

export function MedicosWorkstation({ notify, openModal, usuario, modoConsulta = false }: ClinicActions & { usuario?: PerfilSesion; modoConsulta?: boolean }) {
  const [medicos, setMedicos] = useState<MedicoPerfil[]>([])
  const [medicoId, setMedicoId] = useState(0)
  const [fecha, setFecha] = useState(fechaClinica())
  const [citas, setCitas] = useState<CitaAgendaMedico[]>([])
  const [seleccionId, setSeleccionId] = useState(0)
  const [resumen, setResumen] = useState<ResumenAgenda | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorDirectorio, setErrorDirectorio] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState<'agenda' | 'directorio'>('agenda')
  const [tab, setTab] = useState<'paciente' | 'historial' | 'consulta'>('paciente')
  const [agendar, setAgendar] = useState(false)
  const [configurar, setConfigurar] = useState(false)
  const [soap, setSoap] = useState(vacio)
  const [prescripciones, setPrescripciones] = useState<MedicamentoPrescrito[]>([])
  const [cambios, setCambios] = useState(false)
  const cargada = useRef<CitaAgendaMedico | undefined>(undefined)

  const esMedico = usuario?.rol === 'medico'
  const esAdmin = usuario?.rol === 'admin'
  const esRecepcion = usuario?.rol === 'recepcionista'
  const puedeAgendar = esAdmin || esRecepcion
  const puedeRegistrarConsulta = modoConsulta && esAdmin
  const medico = medicos.find((m) => m.id === medicoId)
  const cita = citas.find((c) => c.id === seleccionId)

  useEffect(() => {
    let vigente = true
    obtenerMedicosBD().then((lista) => {
      if (!vigente) return
      setMedicos(lista)
      const accesibles = esMedico ? lista.filter((m) => m.id === usuario?.medicoId) : lista
      setMedicoId((id) => accesibles.some((m) => m.id === id) ? id : accesibles[0]?.id ?? 0)
      setErrorDirectorio(accesibles.length ? null : esMedico ? 'Tu cuenta no tiene un perfil médico activo vinculado.' : 'No hay médicos activos registrados.')
      if (!accesibles.length) setCargando(false)
    }).catch(() => { if (vigente) { setErrorDirectorio('No se pudo consultar el directorio médico. Usa Actualizar para reintentar.'); setCargando(false) } })
    return () => { vigente = false }
  }, [esMedico, usuario?.medicoId, revision])

  useEffect(() => {
    if (!medicoId) return
    let vigente = true
    setCargando(true)
    Promise.allSettled([obtenerCitasAgendaMedico(medicoId, fecha), leerAgendaMedico(medicoId, fecha)]).then(([resultadoCitas, agenda]) => {
      if (!vigente) return
      const filas = resultadoCitas.status === 'fulfilled' ? resultadoCitas.value : []
      setCitas(filas)
      setResumen(agenda.status === 'fulfilled' ? agenda.value : null)
      const errores = [resultadoCitas, agenda].filter((r) => r.status === 'rejected').map((r) => r.reason instanceof Error ? r.reason.message : 'No se pudieron consultar los datos.')
      setError(errores.join(' ') || null)
      setSeleccionId((id) => filas.some((c) => c.id === id) ? id : filas.find((c) => c.estado === 'confirmada' || c.estado === 'pendiente')?.id ?? filas[0]?.id ?? 0)
      setCargando(false)
    })
    return () => { vigente = false }
  }, [medicoId, fecha, revision])

  useEffect(() => {
    const actualizar = () => { if (!document.hidden) setRevision((v) => v + 1) }
    const timer = window.setInterval(actualizar, 60000)
    window.addEventListener('datos-actualizados', actualizar)
    window.addEventListener('focus', actualizar)
    document.addEventListener('visibilitychange', actualizar)
    return () => { clearInterval(timer); window.removeEventListener('datos-actualizados', actualizar); window.removeEventListener('focus', actualizar); document.removeEventListener('visibilitychange', actualizar) }
  }, [])

  useEffect(() => {
    if (cita && !cambios && !guardando && cargada.current !== cita) {
      cargada.current = cita
      setSoap(cita.soap ?? vacio)
      setPrescripciones(cita.prescripciones ?? [])
    }
  }, [cita, cambios, guardando])

  useEffect(() => {
    if (!cambios) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cambios])

  function descartar() { return !cambios || window.confirm('Hay cambios de consulta sin guardar. ¿Quieres descartarlos?') }
  function cambiarContexto() {
    if (guardando || !descartar()) return false
    setCambios(false); cargada.current = undefined; setSeleccionId(0); setCitas([]); setResumen(null); setTab('paciente')
    return true
  }
  function cambiarFecha(nueva: string) {
    if (nueva && nueva !== fecha && cambiarContexto()) setFecha(nueva)
  }
  function cambiarMedico(id: number) {
    if (id === medicoId || cambiarContexto()) { setMedicoId(id); setVista('agenda') }
  }
  function seleccionarCita(id: number) {
    if (guardando || id === seleccionId || !descartar()) return
    setCambios(false); setSeleccionId(id); setTab('paciente')
  }
  async function guardar(concluir: boolean) {
    if (!cita || !puedeRegistrarConsulta || guardando || cargando) return
    if (concluir && !soap.diagnosticos.length) { notify('Registra el diagnóstico antes de finalizar la consulta.'); return }
    if (prescripciones.some((p) => !p.nombre.trim() || (p.textoOriginal === undefined && !p.posologia.trim()))) { notify('Completa el nombre y las indicaciones de cada medicamento.'); return }
    setGuardando(true)
    try {
      const r = await finalizarConsultaYFirmar({ citaId: cita.id, soap, diagnosticos: soap.diagnosticos, prescripciones, signosVitales: cita.signosVitales, concluir })
      notify(r.mensaje)
      if (r.ok) { setCambios(false); setRevision((v) => v + 1) }
    } finally { setGuardando(false) }
  }
  const vigentes = citas.filter((c) => c.estado !== 'cancelada')
  const estadisticas = [
    { titulo: 'Citas del día', numero: vigentes.length, Icon: CalendarDays, color: 'bg-blue-50 text-blue-600' },
    { titulo: 'Por confirmar', numero: vigentes.filter((c) => c.estado === 'pendiente').length, Icon: Clock3, color: 'bg-amber-50 text-amber-600' },
    { titulo: 'Confirmadas', numero: vigentes.filter((c) => c.estado === 'confirmada').length, Icon: UserRound, color: 'bg-indigo-50 text-indigo-600' },
    { titulo: 'Atendidas', numero: vigentes.filter((c) => c.estado === 'atendida').length, Icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
  ]
  const abrirFicha = () => { if (cita) openModal(`PacienteDetalle: ${cita.pacienteId}`) }
  const tabs = [{ id: 'paciente', texto: 'Datos del paciente' }, ...(!esRecepcion ? [{ id: 'historial', texto: 'Historial' }] : []), ...(puedeRegistrarConsulta ? [{ id: 'consulta', texto: 'Registrar consulta' }] : [])]

  return <section className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-600"><Stethoscope size={16} />Atención y seguimiento</p><h2 className="text-2xl font-semibold tracking-tight text-slate-900">{puedeRegistrarConsulta ? 'Mi Consulta' : 'Agenda médica'}</h2><p className="mt-2 text-sm text-slate-500">{puedeRegistrarConsulta ? 'Consulta la agenda y registra la atención del paciente.' : 'Organiza citas, revisa intervalos y consulta la disponibilidad.'}</p></div>
      <div className="flex flex-wrap gap-2">
        {!esMedico && <button type="button" disabled={guardando} className={BOTON_SECUNDARIO} onClick={() => setVista(vista === 'agenda' ? 'directorio' : 'agenda')}>{vista === 'agenda' ? 'Directorio' : 'Ver agenda'}</button>}
        {esAdmin && <button type="button" className={BOTON_SECUNDARIO} disabled={!medico || !resumen || cargando || guardando} onClick={() => setConfigurar(true)}><Settings2 size={15} />Configurar horario</button>}
        {puedeAgendar && <button type="button" className={BOTON_PRIMARIO} disabled={!medico || guardando} onClick={() => setAgendar(true)}><Plus size={16} />Agendar cita</button>}
      </div>
    </header>
    <AvisoClinico mensaje={errorDirectorio || error} />
    {vista === 'directorio' ? <DirectorioMedicos medicos={medicos} puedeRegistrar={esAdmin} onAbrirModal={openModal} onSeleccionarMedico={(m) => cambiarMedico(m.id)} /> : <>
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="w-full min-w-0 sm:w-auto sm:max-w-md sm:flex-1">{!esMedico ? <label className="block text-xs font-medium text-slate-500">Médico<select aria-label="Seleccionar médico de la agenda" className={CAMPO_CLINICO + ' font-semibold'} disabled={guardando || !medicos.length} value={medicoId} onChange={(e) => cambiarMedico(Number(e.target.value))}>{!medicos.length && <option value="0">Sin médicos disponibles</option>}{medicos.map((m) => <option key={m.id} value={m.id}>{m.nombre} · {m.especialidad}</option>)}</select></label> : <p className="text-base font-semibold text-slate-900">{medico?.nombre}</p>}<p className="mt-2 break-words text-xs leading-relaxed text-slate-500">{medico ? `${medico.clinica} · Cédula: ${medico.cedula}` : 'Selecciona un médico para consultar su agenda.'}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Día anterior" disabled={guardando} className={BOTON_SECUNDARIO + ' px-3'} onClick={() => cambiarFecha(sumarDias(fecha, -1))}><ChevronLeft size={16} /></button>
          <label className="sr-only" htmlFor="fecha-agenda-medica">Fecha de la agenda médica</label><input id="fecha-agenda-medica" type="date" disabled={guardando} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2.5 text-sm text-slate-700" value={fecha} onChange={(e) => cambiarFecha(e.target.value)} />
          <button type="button" aria-label="Día siguiente" disabled={guardando} className={BOTON_SECUNDARIO + ' px-3'} onClick={() => cambiarFecha(sumarDias(fecha, 1))}><ChevronRight size={16} /></button>
          <button type="button" className={BOTON_SECUNDARIO} disabled={guardando} onClick={() => cambiarFecha(fechaClinica())}>Hoy</button>
          <button type="button" title="Actualizar agenda" aria-label="Actualizar" className={BOTON_SECUNDARIO + ' px-3'} disabled={cargando || guardando} onClick={() => setRevision((v) => v + 1)}><RefreshCw size={16} className={cargando ? 'animate-spin' : ''} /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{estadisticas.map(({ titulo, numero, Icon, color }) => <div key={titulo} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className={'hidden rounded-xl p-2.5 sm:block ' + color}><Icon size={18} /></span><div><p className="text-xs text-slate-500">{titulo}</p><p className="mt-1 text-xl font-semibold text-slate-900">{cargando ? '—' : numero}</p></div></div>)}</div>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-busy={cargando}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarDays size={17} className="text-blue-600" />Agenda del día</h3><p className="mt-1 text-xs text-slate-500">Selecciona una cita para ver su detalle.</p>
            <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto">{cargando && !citas.length ? <p role="status" className="py-6 text-sm text-slate-500">Consultando agenda...</p> : !citas.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{error ? 'La agenda no pudo cargarse.' : 'Sin citas registradas para esta fecha.'}</p> : citas.map((c) => <button type="button" key={c.id} disabled={guardando} onClick={() => seleccionarCita(c.id)} aria-pressed={c.id === seleccionId} className={'block w-full rounded-xl border p-3.5 text-left transition disabled:opacity-60 ' + (c.id === seleccionId ? 'border-blue-400 bg-blue-50/70' : 'border-slate-200 hover:bg-slate-50')}><p className="text-xs font-semibold text-slate-800">{horaClinica(c.inicio)} – {horaClinica(c.fin)}</p><p className="mt-2 break-words text-sm font-semibold text-slate-900">{c.pacienteNombre}</p><p className="mt-1 truncate text-xs text-slate-500">{c.motivo}</p><span className={'mt-3 inline-block rounded-full px-2 py-1 text-[11px] font-medium ' + (c.estado === 'cancelada' ? 'bg-slate-100 text-slate-500' : c.estado === 'atendida' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-100 text-blue-700')}>{estadoTexto[c.estado]}</span></button>)}</div>
          </section>
          <DisponibilidadMedico key={`${medicoId}-${fecha}`} resumen={resumen} fecha={fecha} cargando={cargando} />
        </aside>
        <div className="min-w-0 space-y-5">
          {cita ? <>
            <PacienteHeader cita={cita} onAbrirFicha={abrirFicha} />
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Información del paciente en consulta">{tabs.map((t) => <button key={t.id} type="button" id={`consulta-tab-${t.id}`} role="tab" aria-controls="consulta-panel" aria-selected={tab === t.id} disabled={guardando} onClick={() => setTab(t.id as typeof tab)} className={'rounded-xl px-4 py-2.5 text-sm font-semibold ' + (tab === t.id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600')}>{t.texto}</button>)}</div>
            <div id="consulta-panel" role="tabpanel" aria-labelledby={`consulta-tab-${tab}`} className="space-y-5">
              {tab === 'paciente' ? <>
                {!esRecepcion && <SignosVitalesWidget signos={cita.signosVitales} onAbrirFicha={abrirFicha} />}
                <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-semibold text-slate-800">Motivo de la cita</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{cita.motivo}</p></section>
              </> : tab === 'historial' ? <><AvisoClinico mensaje={cita.historialError ?? null} /><AntecedentesMedicamentos consultasPrevias={cita.consultasPrevias} medicamentosActivos={cita.medicamentosActivos} /></> : puedeRegistrarConsulta && <fieldset disabled={guardando || cargando || cita.estado === 'cancelada' || cita.estado === 'atendida'} className="min-w-0 space-y-5">
                <AvisoClinico mensaje={cita.estado === 'atendida' ? 'Esta cita ya fue atendida. Consulta o corrige su expediente desde Expedientes.' : cita.estado === 'cancelada' ? 'No se puede finalizar una cita cancelada.' : null} />
                <ConsultaSoap key={`soap-${cita.id}`} soap={soap} onChangeSoap={(v) => { setSoap(v); setCambios(true) }} />
                <PrescripcionReceta key={`receta-${cita.id}`} prescripciones={prescripciones} onActualizarPrescripciones={(v) => { setPrescripciones(v); setCambios(true) }} />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"><p role="status" className="text-xs text-slate-500">{guardando ? 'Guardando consulta...' : cambios ? 'Cambios sin guardar' : 'Sin cambios pendientes'}</p><div className="flex flex-wrap gap-3"><button type="button" className={BOTON_SECUNDARIO} onClick={() => void guardar(false)}><FileText size={16} />Guardar borrador</button><button type="button" className={BOTON_PRIMARIO} onClick={() => void guardar(true)}>Guardar y finalizar consulta</button></div></div>
              </fieldset>}
            </div>
          </> : <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500"><UserRound size={26} /></span><h3 className="mt-4 text-base font-semibold text-slate-800">{cargando ? 'Cargando citas' : 'Tu agenda está lista'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{cargando ? 'Estamos consultando la información del día seleccionado.' : 'Selecciona una cita para consultar al paciente o elige otra fecha.'}</p>{puedeAgendar && !cargando && <button type="button" className={BOTON_PRIMARIO + ' mt-5'} disabled={!medico} onClick={() => setAgendar(true)}><Plus size={16} />Nueva cita</button>}</div>}
        </div>
      </div>
    </>}
    {agendar && <ModalNuevaCita medicoIdInicial={medicoId} onClose={() => setAgendar(false)} onSave={notify} />}
    {configurar && medico && resumen && <ConfigurarHorario medicoId={medicoId} nombre={medico.nombre} iniciales={resumen.bloques} descansosIniciales={resumen.descansos} onClose={() => setConfigurar(false)} onSave={() => { notify('Horario configurado correctamente'); window.dispatchEvent(new Event('datos-actualizados')) }} />}
  </section>
}
