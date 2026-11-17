'use client'
import { useEffect, useRef, useState } from 'react'
import { SIGNOS_ENFERMERIA, fechaEnfermeria } from '@/lib/enfermeria/modelo'
import { Plus, Trash2 } from 'lucide-react'
import { ConfirmacionClinica, type ConfirmacionClinicaDatos } from '@/components/modulos/compartidos/confirmacion-clinica'
import { NotificacionFlotante } from '@/components/modulos/compartidos/notificacion-flotante'
import { ModalMarco } from '@/components/modulos/compartidos/modal-marco'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '@/components/modulos/compartidos/editor-clinico'
import { EstadoLlegada } from '@/components/modulos/citas/estado-llegada'
import { DocumentosClinicos } from '@/components/modulos/compartidos/documentos-clinicos'
import { contenidoInicial, CONTENIDO_VACIO, imprimirReceta, operarMedico, type ConsultaMedica, type ContenidoConsulta } from '@/lib/medico/modelo'
import { claveBorradorConsulta, firmaContenidoConsulta, leerBorradorConsulta, medicamentosCompletos, protegerBorradorConsulta, retirarBorradorConsulta, type BorradorConsulta } from '@/lib/medico/borrador'
import { cargarHistorialPaciente, type HistorialPaciente } from '@/lib/supabase/datos'
import { subirDocumentoClinico } from '@/lib/documentos-clinicos'
import { leerFichaClinica } from '@/lib/pacientes/ficha-clinica'
const caja = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-5'
export function ModalConsultaMedica({ citaId, onClose, onControl, tabInicial = 'nota' }: { citaId: number; onClose: () => void; onControl?: (pacienteId: number, citaId: number) => void; tabInicial?: 'nota' | 'historial' | 'correcciones' }) {
  const [consulta, setConsulta] = useState<ConsultaMedica | null>(null), [datos, setDatos] = useState<ContenidoConsulta>(CONTENIDO_VACIO)
  const [error, setError] = useState(''), [mensaje, setMensaje] = useState(''), [guardando, setGuardando] = useState(false), [cambios, setCambios] = useState(false)
  const [tab, setTab] = useState<string>(tabInicial), [motivo, setMotivo] = useState(''), [correccion, setCorreccion] = useState('')
  const [orden, setOrden] = useState({ tipo: 'analisis', descripcion: '', instrucciones: '', analisisId: '' })
  const [notificacionId, setNotificacionId] = useState(0)
  function notificar(texto: string) { setMensaje(texto); setNotificacionId(n => n + 1) }
  const [confirmacion, setConfirmacion] = useState<ConfirmacionClinicaDatos | null>(null)
  const citaActualId = useRef(citaId); citaActualId.current = citaId
  const [historial,setHistorial]=useState<HistorialPaciente[]>([]),[archivo,setArchivo]=useState<File>(),[revisionDocumentos,setRevisionDocumentos]=useState(0),[solicitud,setSolicitud]=useState('')
  const pendiente = useRef<{ firma: string; clave: string } | null>(null)
  const [autoguardando, setAutoguardando] = useState(false), [estadoBorrador, setEstadoBorrador] = useState('')
  const [recuperable, setRecuperable] = useState<BorradorConsulta | null>(null)
  const actual = useRef<ConsultaMedica | null>(null), contenidoActual = useRef<ContenidoConsulta>(CONTENIDO_VACIO)
  const sucio = useRef(false), ocupado = useRef(false), pausaAuto = useRef(false), protegida = useRef(false), claveLocal = useRef<string | null>(null)
  const enCurso = useRef<Promise<boolean> | null>(null), montado = useRef(true)
  const cerrada = consulta?.nota?.estado_nota === 'cerrada'
  const editable = consulta?.puedeEditar && !cerrada && ['pendiente', 'confirmada'].includes(consulta.cita.estado)
  const puedeEditar = (c: ConsultaMedica | null) => Boolean(c?.puedeEditar && c.nota?.estado_nota !== 'cerrada' && ['pendiente', 'confirmada'].includes(c.cita.estado))
  function proteger() {
    protegida.current = Boolean(actual.current && protegerBorradorConsulta(claveLocal.current, actual.current.version, contenidoActual.current))
    return protegida.current
  }
  function actualizarDatos(cambiar: (d: ContenidoConsulta) => ContenidoConsulta) {
    const siguiente = cambiar(contenidoActual.current)
    contenidoActual.current = siguiente; sucio.current = true; setDatos(siguiente); setCambios(true)
    setEstadoBorrador(proteger() ? 'Avance protegido en esta pestaña. Pendiente de guardar.' : 'Hay cambios pendientes. Mantén esta ventana abierta hasta guardar.')
  }
  async function leerServidor() {
    const r = await fetch(`/api/medico?cita=${citaId}`, { cache: 'no-store' }), b = await r.json()
    if (!r.ok) throw Object.assign(Error(b.error || 'No se pudo consultar la nota.'), { status: r.status })
    return b as ConsultaMedica
  }
  function presentar(b: ConsultaMedica, inicial = false) {
    actual.current = b; setConsulta(b); claveLocal.current = b.editorId ? claveBorradorConsulta(b.editorId, citaId) : null
    const servidor = contenidoInicial(b.nota)
    contenidoActual.current = servidor; setDatos(servidor); sucio.current = false; setCambios(false); pausaAuto.current = false; setRecuperable(null)
    if (!puedeEditar(b)) { retirarBorradorConsulta(claveLocal.current); return }
    if (inicial && claveLocal.current) {
      let copia: BorradorConsulta | null = null
      try { copia = leerBorradorConsulta(claveLocal.current, window.sessionStorage) } catch {}
      if (copia && firmaContenidoConsulta(copia.contenido) !== firmaContenidoConsulta(servidor)) {
        if (copia.version !== b.version) { setRecuperable(copia); pausaAuto.current = true; return }
        contenidoActual.current = copia.contenido; setDatos(copia.contenido); sucio.current = true; setCambios(true); protegida.current = true
        setEstadoBorrador('Se recuperó tu borrador después de salir. El autoguardado está activo.'); return
      }
    }
    retirarBorradorConsulta(claveLocal.current); protegida.current = false
  }
  async function cargar(reemplazar = true) {
    const b = await leerServidor()
    if (!montado.current) return b
    if (reemplazar) presentar(b)
    else { actual.current = b; setConsulta(b) }
    return b
  }
  useEffect(() => {
    montado.current = true; let vigente = true
    void leerServidor().then(b => { if (vigente) presentar(b, true) }).catch(e => { if (vigente) setError(e.message || 'No se pudo consultar la nota.') })
    return () => { vigente = false; montado.current = false }
  }, [citaId])
  function solicitudGuardar(cerrar: boolean) {
    const payload = { citaId, version: actual.current!.version, contenido: contenidoActual.current, cerrar }, firma = JSON.stringify({ accion: 'guardar', payload })
    if (pendiente.current?.firma !== firma) pendiente.current = { firma, clave: crypto.randomUUID() }
    return { payload, clave: pendiente.current.clave }
  }
  async function guardarNota(cerrar = false, automatico = false): Promise<boolean> {
    if (enCurso.current) { if (automatico) return false; await enCurso.current }
    if (ocupado.current || !puedeEditar(actual.current) || (automatico && (pausaAuto.current || !sucio.current))) return false
    if (!sucio.current && !cerrar && actual.current?.nota) { if (!automatico) notificar('Consulta guardada.'); return true }
    if (!medicamentosCompletos(contenidoActual.current)) { setEstadoBorrador('Avance protegido en esta pestaña. Completa los datos de los medicamentos para guardarlo en la clínica.'); if (!automatico) setError('Completa nombre, dosis, vía, frecuencia y duración de cada medicamento antes de guardar.'); return false }
    const guardar = async () => {
      ocupado.current = true
      if (automatico) setAutoguardando(true); else { setGuardando(true); setError(''); setMensaje('') }
      const { payload, clave } = solicitudGuardar(cerrar), firma = firmaContenidoConsulta(payload.contenido)
      try {
        const r = await operarMedico('guardar', payload, clave), b = await leerServidor()
        if (!montado.current || citaActualId.current !== payload.citaId) return true
        // No se reemplaza una edición que se hizo mientras viajaba el autoguardado.
        const servidor = contenidoInicial(b.nota)
        if (!cerrar && firmaContenidoConsulta(servidor) !== firma) throw Object.assign(Error('La nota cambió en otra ventana. Tu avance se conserva; revisa la nota antes de guardar.'), { status: 409 })
        actual.current = b; setConsulta(b); pendiente.current = null; pausaAuto.current = false
        if (cerrar || firmaContenidoConsulta(contenidoActual.current) === firma) {
          contenidoActual.current = servidor; setDatos(servidor); sucio.current = false; setCambios(false); retirarBorradorConsulta(claveLocal.current); protegida.current = false
        } else proteger()
        setEstadoBorrador(cerrar ? '' : automatico ? 'Guardado automáticamente en la clínica.' : 'Guardado en la clínica.')
        if (!automatico) notificar(cerrar ? 'Consulta finalizada correctamente.' : 'Consulta guardada.')
        window.dispatchEvent(new Event('datos-actualizados')); return true
      } catch (e) {
        pausaAuto.current = true
        if (montado.current) { const texto = e instanceof Error ? e.message : 'No se pudo guardar.'; setError(texto); setEstadoBorrador(proteger() ? 'Tu avance está protegido en esta pestaña. Revisa el aviso y pulsa Guardar para reintentar.' : 'No se pudo proteger el avance. No cierres la ventana hasta guardarlo.') }
        return false
      } finally { ocupado.current = false; if (montado.current) { setGuardando(false); setAutoguardando(false) } }
    }
    const trabajo = guardar(); enCurso.current = trabajo
    try { return await trabajo } finally { if (enCurso.current === trabajo) enCurso.current = null }
  }
  useEffect(() => {
    if (!editable || !cambios || guardando || autoguardando || pausaAuto.current) return
    const t = window.setTimeout(() => { void guardarNota(false, true) }, 1500)
    return () => window.clearTimeout(t)
  }, [datos, cambios, editable, guardando, autoguardando])
  useEffect(() => {
    const protegerSalida = (e: BeforeUnloadEvent) => {
      if (!sucio.current || !puedeEditar(actual.current)) return
      const segura = proteger()
      if (!ocupado.current && !pausaAuto.current && medicamentosCompletos(contenidoActual.current)) {
        const { payload, clave } = solicitudGuardar(false), body = JSON.stringify({ accion: 'guardar', datos: payload, clave })
        if (new TextEncoder().encode(body).length < 60000) void fetch('/api/medico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
      }
      if (!segura) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', protegerSalida)
    return () => window.removeEventListener('beforeunload', protegerSalida)
  }, [citaId])
  async function salir() {
    if (enCurso.current) await enCurso.current
    if (ocupado.current) return
    if (sucio.current && !pausaAuto.current && medicamentosCompletos(contenidoActual.current)) await guardarNota()
    if (!sucio.current || proteger()) onClose()
    else setConfirmacion({ titulo: 'Cambios sin guardar', mensaje: 'No se pudo guardar ni proteger tu avance. Si cierras ahora, perderás los cambios de esta consulta.', confirmar: 'Cerrar sin guardar', accion: onClose })
  }
  function campo(k: keyof Omit<ContenidoConsulta, 'medicamentos'>, v: string) { actualizarDatos(d => ({ ...d, [k]: v })) }
  async function ejecutar(accion: string, extra: Record<string, unknown>) {
    if (accion === 'guardar') { await guardarNota(extra.cerrar === true); return }
    if (enCurso.current) await enCurso.current
    if (!actual.current || ocupado.current) return
    const payload = { citaId, version: actual.current.version, ...extra }, firma = JSON.stringify({ accion, payload })
    if (pendiente.current?.firma !== firma) pendiente.current = { firma, clave: crypto.randomUUID() }
    ocupado.current = true; setGuardando(true); setError(''); setMensaje('')
    try { const r = await operarMedico(accion, payload, pendiente.current.clave); notificar(r.mensaje); pendiente.current = null; await cargar(false); setMotivo(''); setCorreccion(''); if (accion === 'orden') setOrden({tipo:'analisis',descripcion:'',instrucciones:'',analisisId:''}); window.dispatchEvent(new Event('datos-actualizados')) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Tu borrador se conserva.') }
    finally { ocupado.current = false; setGuardando(false) }
  }
  useEffect(()=>{if(tab!=='historial'||!consulta)return;let vigente=true;void cargarHistorialPaciente(consulta.cita.pacienteId).then(r=>{if(vigente){if(r.error)setError(r.error);else setHistorial(r.filas)}});return()=>{vigente=false}},[tab,consulta?.cita.pacienteId])
  const alertas = leerFichaClinica(consulta?.cita.alertas)
  return <ModalMarco title="Atención médica" ancho="max-w-6xl" contenidoFijo onClose={salir} aviso={mensaje ? <NotificacionFlotante key={notificacionId} mensaje={mensaje} onCerrar={() => setMensaje('')} /> : undefined} footer={<div className="flex flex-wrap justify-between gap-3"><button disabled={guardando} className={BOTON_SECUNDARIO} onClick={salir}>Cerrar</button>{tab === 'nota' && editable && <div className="flex flex-wrap gap-2"><button disabled={guardando} className={BOTON_SECUNDARIO} onClick={() => void ejecutar('guardar', { contenido: datos, cerrar: false })}>Guardar</button><button disabled={guardando} className={BOTON_PRIMARIO} onClick={() => setConfirmacion({ titulo: 'Finalizar consulta', mensaje: 'Se guardará la nota y la cita quedará atendida. Después del cierre no podrás modificar la nota original; podrás añadir aclaraciones. ¿Deseas finalizar la consulta?', confirmar: 'Confirmar cierre de consulta', tono: 'primario', accion: () => { void ejecutar('guardar', { cerrar: true }) } })}>Finalizar consulta</button></div>}{cerrada && consulta?.puedeEditar && onControl && <button className={BOTON_PRIMARIO} onClick={() => onControl(consulta.cita.pacienteId, citaId)}>Programar control</button>}{cerrada && <button className={BOTON_SECUNDARIO} onClick={() => { try { imprimirReceta(consulta!) } catch (e) { setError((e as Error).message) } }}>Receta PDF</button>}</div>}>
    {confirmacion && <ConfirmacionClinica {...confirmacion} onCancelar={() => setConfirmacion(null)} onConfirmar={() => { const accion = confirmacion.accion; setConfirmacion(null); accion() }} />}
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}<button type="button" disabled={guardando} className="ml-3 font-semibold underline" onClick={() => { const recargar = () => { void cargar().then(() => setError('')).catch(e => setError(e.message)) }; if (!cambios) recargar(); else setConfirmacion({ titulo: 'Recargar nota del servidor', mensaje: 'Se reemplazará el avance de esta ventana por la nota guardada en la clínica. Los cambios pendientes se descartarán.', confirmar: 'Recargar nota', accion: recargar }) }}>Recargar nota del servidor</button></p>}
    {editable && estadoBorrador && <p aria-live="polite" className="mb-4 text-xs text-slate-500">{autoguardando ? 'Guardando automáticamente…' : estadoBorrador}</p>}
    {recuperable && <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">Hay un borrador recuperado, pero la nota del servidor cambió. No se reemplazará automáticamente. Puedes recuperar tu avance para revisarlo y después pulsar Guardar.</p><button type="button" className={BOTON_SECUNDARIO + ' mt-3'} onClick={() => { const copia = recuperable.contenido; contenidoActual.current = copia; setDatos(copia); sucio.current = true; setCambios(true); proteger(); setRecuperable(null); setEstadoBorrador('Borrador recuperado. Revisa la nota y pulsa Guardar para confirmar tus cambios.'); }}>Recuperar mi borrador</button><button type="button" className={BOTON_SECUNDARIO + ' ml-3 mt-3'} onClick={() => { setConfirmacion({ titulo: 'Descartar borrador recuperado', mensaje: 'Se eliminará la copia de recuperación de esta pestaña y se conservará la nota del servidor.', confirmar: 'Descartar borrador', accion: () => { retirarBorradorConsulta(claveLocal.current); setRecuperable(null); pausaAuto.current = false } }) }}>Conservar nota del servidor</button></section>}
    {!consulta ? <p className="py-8 text-sm text-slate-500">{error ? 'La consulta no está disponible.' : 'Consultando nota…'}</p> : <div className="space-y-5"><div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-medium text-blue-700">Cita #{citaId} · {cerrada ? 'Nota cerrada' : 'Borrador'}</p><h3 className="mt-2 text-xl font-semibold">{consulta.cita.paciente}</h3><p className="mt-2 text-sm text-slate-600">{consulta.cita.medico} · {consulta.cita.motivo}</p><p className="mt-3 text-xs text-slate-600">Alergias: {alertas.alergias || 'Sin registro'} · Antecedentes: {alertas.condicionesCronicas || 'Sin registro'}</p></div>
      <EstadoLlegada citaId={citaId} />
      {consulta.signos && <section className={caja}><h4 className="font-semibold">{cerrada?'Signos conservados al cerrar la nota':'Últimos signos registrados por enfermería'}</h4><p className="mt-2 text-xs text-slate-500">{fechaEnfermeria(consulta.signos.fecha)} · {consulta.signos.autor}</p><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{SIGNOS_ENFERMERIA.filter(s=>consulta.signos?.valores[s.id]!=null).map(s=><div className="rounded-xl bg-slate-50 p-3" key={s.id}><dt className="text-xs text-slate-500">{s.nombre}</dt><dd className="mt-1 font-semibold">{consulta.signos!.valores[s.id]} <span className="text-xs font-normal text-slate-500">{s.unidad}</span></dd></div>)}</dl></section>}
      <nav aria-label="Secciones de atención" className="flex flex-wrap gap-2">{[['nota', 'Nota clínica'], ['ordenes', 'Órdenes ambulatorias'], ['documentos', 'Documentos'], ['historial', 'Historial del paciente'], ['cita', 'Coordinar cita'], ['correcciones', 'Aclaraciones']].filter(([id])=>id!=='cita'||consulta.puedeSolicitarCambio).map(([id, titulo]) => <button disabled={guardando} key={id} className={tab === id ? BOTON_PRIMARIO : BOTON_SECUNDARIO} onClick={() => setTab(id)}>{titulo}</button>)}</nav>
      {tab === 'nota' && <fieldset disabled={!editable || guardando} className="space-y-5"><div className="grid gap-4 md:grid-cols-2">{([['subjetivo', 'Motivo, síntomas y evolución'], ['objetivo', 'Exploración y hallazgos'], ['diagnostico', 'Diagnóstico o problema clínico'], ['plan', 'Plan de tratamiento e indicaciones'], ['pronostico', 'Pronóstico'], ['seguimiento', 'Seguimiento y próxima revisión']] as const).map(([k, titulo]) => <label key={k} className={ETIQUETA_CLINICA}>{titulo}<textarea rows={4} maxLength={8000} className={CAMPO_CLINICO} value={datos[k]} onChange={e => campo(k, e.target.value)} /></label>)}</div>
        <section className={caja}><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Medicamentos prescritos</h4>{editable && <button type="button" disabled={datos.medicamentos.length >= 30} className={BOTON_SECUNDARIO} onClick={() => { actualizarDatos(d => ({ ...d, medicamentos: [...d.medicamentos, { nombre: '', dosis: '', via: '', frecuencia: '', duracion: '' }] })) }}><Plus size={15} />Agregar medicamento</button>}</div>{!datos.medicamentos.length && <p className="mt-4 text-sm text-slate-500">Sin medicamentos registrados.</p>}{datos.medicamentos.map((m, i) => <div key={i} className="mt-4 rounded-xl border border-slate-200 p-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(['nombre', 'dosis', 'via', 'frecuencia', 'duracion'] as const).map(k => <label key={k} className={ETIQUETA_CLINICA}>{({ nombre: 'Medicamento', dosis: 'Dosis', via: 'Vía', frecuencia: 'Frecuencia', duracion: 'Duración' })[k]}<input maxLength={k === 'via' ? 120 : 200} required className={CAMPO_CLINICO} value={m[k]} onChange={e => { actualizarDatos(d => ({ ...d, medicamentos: d.medicamentos.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x) })) }} /></label>)}</div>{editable && <button className="mt-3 flex items-center gap-1 text-xs font-medium text-rose-700" type="button" onClick={() => { setConfirmacion({ titulo: 'Eliminar medicamento', mensaje: `Vas a eliminar «${m.nombre.trim() || 'Medicamento sin nombre'}» de esta receta. Revisa que sea el medicamento correcto antes de continuar.`, confirmar: 'Eliminar medicamento', accion: () => actualizarDatos(d => ({ ...d, medicamentos: d.medicamentos.filter((_, j) => i !== j) })) }) }}><Trash2 size={14} />Quitar medicamento</button>}</div>)}{datos.recetaLibre && <label className={ETIQUETA_CLINICA + ' mt-4 block'}>Receta previa en texto<textarea className={CAMPO_CLINICO} value={datos.recetaLibre} onChange={e => campo('recetaLibre', e.target.value)} /></label>}</section></fieldset>}
      {tab === 'ordenes' && <div className="space-y-4">{consulta.puedeEditar && !['cancelada_paciente', 'cancelada_medico', 'no_asistio'].includes(consulta.cita.estado) && <form className={caja + ' space-y-4'} onSubmit={e => { e.preventDefault(); void ejecutar('orden', { ...orden, analisisId: orden.analisisId ? Number(orden.analisisId) : null }) }}><p className="text-sm text-slate-500">La indicación quedará vinculada a esta cita; no requiere hospitalización.</p><label className={ETIQUETA_CLINICA}>Tipo de orden<select disabled={guardando} className={CAMPO_CLINICO} value={orden.tipo} onChange={e => setOrden({ ...orden, tipo: e.target.value })}>{['analisis', 'medicamento', 'tratamiento', 'procedimiento'].map(t => <option key={t} value={t}>{({ analisis: 'Estudio de laboratorio', medicamento: 'Medicamento', tratamiento: 'Tratamiento', procedimiento: 'Procedimiento' })[t]}</option>)}</select></label>{orden.tipo === 'analisis' && <label className={ETIQUETA_CLINICA}>Estudio<select required disabled={guardando} className={CAMPO_CLINICO} value={orden.analisisId} onChange={e => { const estudio = consulta.catalogo.find(a => a.id === Number(e.target.value)); setOrden({ ...orden, analisisId: e.target.value, descripcion: estudio?.nombre ?? '' }) }}><option value="">Selecciona un estudio</option>{consulta.catalogo.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>}<label className={ETIQUETA_CLINICA}>Descripción<input required maxLength={2000} disabled={guardando} className={CAMPO_CLINICO} value={orden.descripcion} onChange={e => setOrden({ ...orden, descripcion: e.target.value })} /></label><label className={ETIQUETA_CLINICA}>Indicaciones<textarea required maxLength={8000} disabled={guardando} className={CAMPO_CLINICO} value={orden.instrucciones} onChange={e => setOrden({ ...orden, instrucciones: e.target.value })} /></label><button disabled={guardando} className={BOTON_PRIMARIO}>Emitir orden</button></form>}{consulta.ordenes.map(o => <article key={o.id} className={caja}><p className="text-xs text-blue-700">Orden #{o.id} · {o.estado}</p><h4 className="mt-2 font-semibold">{o.descripcion}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{o.instrucciones}</p></article>)}</div>}
      {tab === 'documentos' && (consulta.nota ? <><DocumentosClinicos key={revisionDocumentos} tipo="expedientes" registroId={consulta.nota.id} soloLectura={!consulta.puedeEditar} archivo={archivo} onArchivo={setArchivo} disabled={guardando} />{archivo && consulta.puedeEditar && <button disabled={guardando} className={BOTON_PRIMARIO + ' mt-4'} onClick={async()=>{setGuardando(true);setError('');try{const fallo=await subirDocumentoClinico('expedientes',consulta.nota!.id,archivo);if(fallo)throw Error(fallo);setArchivo(undefined);setRevisionDocumentos(v=>v+1);setMensaje('PDF añadido. Los documentos anteriores se conservan.')}catch(e){setError((e as Error).message)}finally{setGuardando(false)}}}>Adjuntar PDF</button>}</> : <p className="text-sm text-slate-500">Guarda la nota para consultar sus documentos.</p>)}
      {tab === 'historial' && <div className="space-y-4">{historial.map(h=><article key={h.id} className={caja}><p className="text-xs text-slate-500">{h.fecha} · {h.medico}</p><h4 className="mt-2 font-semibold">{h.motivo}</h4><p className="mt-3 whitespace-pre-wrap text-sm">{h.diagnostico}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{h.receta}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{h.notas}</p></article>)}{!historial.length&&<p className="text-sm text-slate-500">No hay consultas previas disponibles.</p>}</div>}
      {tab === 'cita' && <form className={caja+' space-y-4'} onSubmit={e=>{e.preventDefault();void ejecutar('solicitar_cambio',{motivo:solicitud})}}><p className="text-sm text-slate-500">Recepción coordinará el cambio con el paciente. La cita actual se conserva; requiere más de dos horas de anticipación y no tener llegada registrada.</p><label className={ETIQUETA_CLINICA}>Motivo para solicitar otro horario<textarea disabled={guardando||!editable} required minLength={10} maxLength={800} className={CAMPO_CLINICO} value={solicitud} onChange={e=>setSolicitud(e.target.value)}/></label><button disabled={guardando||!editable||Date.parse(consulta.cita.inicio)-Date.now()<=2*3600000} className={BOTON_PRIMARIO}>Solicitar cambio a recepción</button></form>}
      {tab === 'correcciones'  && <div className="space-y-4">{consulta.correcciones.map(r => <article className={caja} key={r.id}><p className="text-xs text-slate-500">{r.autor} · {new Date(r.fecha).toLocaleString('es-MX')}</p><p className="mt-3 text-sm font-medium">Motivo: {r.motivo}</p><p className="mt-2 whitespace-pre-wrap text-sm">{r.texto}</p></article>)}{cerrada && consulta.puedeEditar ? <form className={caja + ' space-y-4'} onSubmit={e => { e.preventDefault(); void ejecutar('corregir', { motivo, texto: correccion }) }}><p className="text-sm text-slate-500">Se añadirá una aclaración con tu identidad; la nota cerrada se conserva.</p><label className={ETIQUETA_CLINICA}>Motivo de la aclaración<input required disabled={guardando} maxLength={1000} className={CAMPO_CLINICO} value={motivo} onChange={e => setMotivo(e.target.value)} /></label><label className={ETIQUETA_CLINICA}>Texto de la aclaración<textarea required disabled={guardando} maxLength={8000} className={CAMPO_CLINICO} value={correccion} onChange={e => setCorreccion(e.target.value)} /></label><button disabled={guardando} className={BOTON_PRIMARIO}>Añadir aclaración</button></form> : <p className="text-sm text-slate-500">Las aclaraciones se agregan después de cerrar la nota y por su médico responsable.</p>}</div>}
    </div>}
  </ModalMarco>
}
