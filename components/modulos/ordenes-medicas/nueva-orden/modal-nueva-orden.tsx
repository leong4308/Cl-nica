'use client'

import { useEffect, useState } from 'react'
import { BedDouble, ClipboardList, FlaskConical, Loader2, Pill, HeartPulse, Stethoscope } from 'lucide-react'
import { ModalMarco } from '../../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, DatoClinico, ETIQUETA_CLINICA, PanelClinico } from '../../compartidos/editor-clinico'
import { DocumentosClinicos } from '../../compartidos/documentos-clinicos'
import { cargarOpcionesOrdenes, crearOrdenMedica, type DatosNuevaOrden } from '@/lib/supabase/datos'
import { subirDocumentoClinico } from '@/lib/documentos-clinicos'

const TIPOS = [{ valor: 'analisis', titulo: 'Análisis', ayuda: 'Estudios de laboratorio', icon: FlaskConical }, { valor: 'medicamento', titulo: 'Medicamento', ayuda: 'Dosis y administración', icon: Pill }, { valor: 'tratamiento', titulo: 'Tratamiento', ayuda: 'Cuidados y seguimiento', icon: HeartPulse }, { valor: 'procedimiento', titulo: 'Procedimiento', ayuda: 'Intervención clínica', icon: Stethoscope }] as const
export function ModalNuevaOrden({ onClose, onSave }: { onClose: () => void; onSave?: (mensaje: string) => void }) {
  const [internaciones, setInternaciones] = useState<{ id: number; paciente: string; habitacionCama: string; medico: string; episodioId: number }[]>([])
  const [catalogo, setCatalogo] = useState<{ id: number; nombre: string; requiereAyuno: boolean }[]>([])
  const [internacionId, setInternacionId] = useState<number | ''>('')
  const [tipoOrden, setTipoOrden] = useState<DatosNuevaOrden['tipoOrden']>('analisis')
  const [analisisId, setAnalisisId] = useState<number | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [archivo, setArchivo] = useState<File>()
  const [validando, setValidando] = useState(false)
  const [idGuardado, setIdGuardado] = useState<number>()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ocupado = guardando || validando
  useEffect(() => {
    let vigente = true
    cargarOpcionesOrdenes().then((res) => {
      if (!vigente) return
      setInternaciones(res.internacionesActivas); setCatalogo(res.catalogoAnalisis)
      setInternacionId(res.internacionesActivas[0]?.id ?? '')
      if (res.catalogoAnalisis[0]) { setAnalisisId(res.catalogoAnalisis[0].id); setDescripcion('Solicitud de análisis: ' + res.catalogoAnalisis[0].nombre) }
      setError(res.error); setCargando(false)
    }).catch(() => { if (vigente) { setError('No se pudieron cargar las opciones de la orden.'); setCargando(false) } })
    return () => { vigente = false }
  }, [])
  const internacion = internaciones.find((i) => i.id === Number(internacionId))
  const analisis = catalogo.find((a) => a.id === Number(analisisId))
  function cambiarTipo(tipo: DatosNuevaOrden['tipoOrden']) {
    setTipoOrden(tipo)
    setDescripcion(tipo === 'analisis' ? (analisis ? 'Solicitud de análisis: ' + analisis.nombre : '') : tipo === 'medicamento' ? 'Administración de medicamento' : tipo === 'tratamiento' ? 'Plan de tratamiento médico' : 'Procedimiento clínico programado')
  }
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (ocupado || !internacion || !descripcion.trim() || (tipoOrden === 'analisis' && !analisisId)) return
    setGuardando(true); setError(null)
    try {
      let id = idGuardado
      if (!id) {
        const res = await crearOrdenMedica({ internacionId: internacion.id, episodioId: internacion.episodioId, tipoOrden, descripcion: descripcion.trim(), instrucciones: instrucciones.trim(), analisisId: tipoOrden === 'analisis' ? Number(analisisId) : undefined })
        if (res.id) { id = res.id; setIdGuardado(id) }
        if (res.error || !id) { setError(res.error || 'No se pudo guardar la orden.'); return }
      }
      if (archivo) { const fallo = await subirDocumentoClinico('ordenes', id, archivo); if (fallo) { setError('La orden ya se guardó. El PDF sigue pendiente: ' + fallo + ' Reintenta la carga o cierra para conservar la orden sin el adjunto.'); return } }
      onSave?.('Orden médica emitida para ' + internacion.paciente); onClose()
    } catch { setError('No se pudo completar la operación. Revisa la orden antes de volver a intentar.') }
    finally { setGuardando(false) }
  }
  return <ModalMarco title="Nueva orden médica" ancho="max-w-5xl" contenidoFijo onClose={() => { if (!ocupado) onClose() }} footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">PDF opcional, máximo 2 MB.</p><div className="flex gap-2"><button type="button" className={BOTON_SECUNDARIO} onClick={onClose} disabled={ocupado}>Cancelar</button><button type="submit" form="form-nueva-orden" className={BOTON_PRIMARIO} disabled={ocupado || cargando || !internacion || !descripcion.trim() || (tipoOrden === 'analisis' && !analisisId)}>{guardando && <Loader2 size={16} className="animate-spin" />}{guardando ? 'Guardando...' : idGuardado ? 'Adjuntar PDF pendiente' : 'Emitir orden médica'}</button></div></div>}>
    <p className="mb-5 text-sm text-slate-500">Indica qué necesita el paciente y cómo debe realizarse la atención.</p><AvisoClinico mensaje={error} />
    {cargando ? <p role="status" className="py-12 text-center text-sm text-slate-500">Cargando pacientes y catálogo...</p> : !internaciones.length ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No hay pacientes con internación activa para emitir una orden médica.</p> : <form id="form-nueva-orden" onSubmit={guardar}><div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)]">
      <div className="min-w-0 space-y-5"><PanelClinico icon={BedDouble} titulo="Paciente y atención" ayuda="Vincula la orden con su hospitalización." suave><label htmlFor="orden-paciente" className={ETIQUETA_CLINICA}>Paciente hospitalizado</label><select id="orden-paciente" className={CAMPO_CLINICO} disabled={ocupado || Boolean(idGuardado)} value={internacionId} onChange={(e) => setInternacionId(Number(e.target.value))} required>{internaciones.map((i) => <option key={i.id} value={i.id}>{i.paciente} · {i.habitacionCama}</option>)}</select>{internacion && <dl className="mt-5 space-y-4 border-t border-slate-200 pt-4"><DatoClinico etiqueta="Paciente" valor={internacion.paciente} /><DatoClinico etiqueta="Ubicación" valor={internacion.habitacionCama} /><DatoClinico etiqueta="Médico responsable" valor={internacion.medico} /></dl>}</PanelClinico><DocumentosClinicos tipo="ordenes" archivo={archivo} onArchivo={setArchivo} onValidando={setValidando} disabled={ocupado} /></div>
      <fieldset disabled={ocupado || Boolean(idGuardado)} className="min-w-0"><PanelClinico icon={ClipboardList} titulo="Indicación médica" ayuda="Selecciona el tipo y completa las instrucciones."><div className="space-y-5"><fieldset><legend className={ETIQUETA_CLINICA}>Tipo de orden médica</legend><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{TIPOS.map(({ valor, titulo, ayuda, icon: Icon }) => <label key={valor} className={'flex cursor-pointer items-start gap-2 rounded-xl border p-3 focus-within:ring-2 focus-within:ring-blue-500 ' + (tipoOrden === valor ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300')}><input type="radio" name="tipo-orden" value={valor} checked={tipoOrden === valor} onChange={() => cambiarTipo(valor)} className="mt-1 accent-blue-600" /><Icon size={17} className="mt-0.5 shrink-0 text-blue-600" /><span><span className="block text-sm font-semibold text-slate-800">{titulo}</span><span className="mt-1 block text-xs text-slate-500">{ayuda}</span></span></label>)}</div></fieldset>
      {tipoOrden === 'analisis' && <div><label htmlFor="orden-estudio" className={ETIQUETA_CLINICA}>Estudio de laboratorio</label><select id="orden-estudio" className={CAMPO_CLINICO} value={analisisId} onChange={(e) => { const id = Number(e.target.value); setAnalisisId(id); setDescripcion('Solicitud de análisis: ' + (catalogo.find((a) => a.id === id)?.nombre ?? '')) }} required><option value="" disabled>Selecciona un estudio</option>{catalogo.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>{analisis?.requiereAyuno && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Este estudio requiere ayuno.</p>}</div>}
      <label className={ETIQUETA_CLINICA}>Descripción de la orden <span className="text-blue-600">*</span><textarea rows={3} className={CAMPO_CLINICO + ' resize-y'} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Describe la indicación médica..." required /></label><label className={ETIQUETA_CLINICA}>Instrucciones clínicas / Posología<textarea rows={4} className={CAMPO_CLINICO + ' resize-y'} value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} placeholder="Dosis, vía, frecuencia, preparación o cuidados necesarios..." /></label></div></PanelClinico></fieldset>
    </div></form>}
  </ModalMarco>
}
