'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, FileText, Loader2, Stethoscope } from 'lucide-react'
import { ModalMarco } from '../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, DatoClinico, ETIQUETA_CLINICA, PanelClinico } from '../compartidos/editor-clinico'
import { DocumentosClinicos } from '../compartidos/documentos-clinicos'
import { guardarOrdenMedica } from '@/lib/supabase/datos'
import { createClient } from '@/lib/supabase/client'
import { subirDocumentoClinico } from '@/lib/documentos-clinicos'
import { Status } from '../citas/estado'

type Orden = { id: number; codigo: string; episodio: string; medico: string; descripcion: string; estado: string }
const ESTADOS = [{ valor: 'prescrita', titulo: 'Prescrita' }, { valor: 'en_proceso', titulo: 'En proceso' }, { valor: 'realizada', titulo: 'Completada' }, { valor: 'cancelada', titulo: 'Cancelada' }]
export function ModalGestionOrden({ orden, modo: modoInicial = 'ver', onClose, onSave }: { orden: Orden; modo?: 'ver' | 'editar'; onClose: () => void; onSave?: (mensaje: string) => void }) {
  const [modo, setModo] = useState(modoInicial)
  const [descripcion, setDescripcion] = useState(orden.descripcion)
  const [instrucciones, setInstrucciones] = useState('')
  const [estado, setEstado] = useState('prescrita')
  const [tipo, setTipo] = useState('')
  const [archivo, setArchivo] = useState<File>()
  const [validando, setValidando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [cargaCorrecta, setCargaCorrecta] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ocupado = guardando || validando
  useEffect(() => {
    let vigente = true
    createClient().from('ordenes_medicas').select('descripcion, instrucciones, estado, tipo_orden').eq('id', orden.id).maybeSingle().then(({ data, error }) => {
      if (!vigente) return
      if (error || !data) setError(error?.message || 'Orden no encontrada.')
      else { setCargaCorrecta(true); setDescripcion(data.descripcion); setInstrucciones(data.instrucciones ?? ''); setEstado(data.estado); setTipo(data.tipo_orden) }
      setCargando(false)
    })
    return () => { vigente = false }
  }, [orden.id])
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (ocupado || cargando || !cargaCorrecta || modo !== 'editar' || !descripcion.trim()) return
    setGuardando(true); setError(null)
    try {
      const res = await guardarOrdenMedica(orden.id, descripcion, instrucciones, estado)
      if (res.error) { setError(res.error); return }
      if (archivo) { const fallo = await subirDocumentoClinico('ordenes', orden.id, archivo); if (fallo) { setError('La orden se actualizó. El PDF sigue pendiente: ' + fallo); return } }
      onSave?.('Orden ' + orden.codigo + ' actualizada correctamente'); onClose()
    } catch { setError('No se pudo guardar la orden. Inténtalo de nuevo.') }
    finally { setGuardando(false) }
  }
  const editando = modo === 'editar'
  return <ModalMarco title={editando ? 'Modificar orden médica' : 'Detalle de orden médica'} ancho="max-w-5xl" contenidoFijo onClose={() => { if (!ocupado) onClose() }} footer={<div className="flex flex-wrap justify-between gap-3"><button type="button" className={BOTON_SECUNDARIO} onClick={onClose} disabled={ocupado}>{editando ? 'Cancelar' : 'Cerrar'}</button>{editando ? <button key="guardar" type="submit" form="form-editar-orden" className={BOTON_PRIMARIO} disabled={ocupado || cargando || !cargaCorrecta || !descripcion.trim()}>{guardando && <Loader2 size={16} className="animate-spin" />}{guardando ? 'Guardando...' : 'Guardar cambios'}</button> : <button key="editar" type="button" className={BOTON_PRIMARIO} onClick={(event) => { event.preventDefault(); setModo('editar') }} disabled={cargando || !cargaCorrecta}>Modificar orden</button>}</div>}>
    <p className="mb-5 text-sm text-slate-500">{editando ? 'Actualiza la indicación, su estado y los documentos de apoyo.' : 'Revisa la indicación y las instrucciones del equipo médico.'}</p><AvisoClinico mensaje={error} />
    <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)]"><div className="min-w-0 space-y-5"><PanelClinico icon={ClipboardList} titulo={orden.codigo} ayuda="Resumen de la orden" suave><div className="mb-5"><Status text={ESTADOS.find((e) => e.valor === estado)?.titulo ?? orden.estado} /></div><dl className="space-y-4"><DatoClinico etiqueta="Episodio clínico" valor={orden.episodio} /><DatoClinico etiqueta="Médico solicitante" valor={orden.medico} /><DatoClinico etiqueta="Tipo de orden" valor={{ analisis: 'Análisis clínico', medicamento: 'Medicamento', tratamiento: 'Tratamiento', procedimiento: 'Procedimiento' }[tipo] ?? tipo} /></dl></PanelClinico><DocumentosClinicos tipo="ordenes" registroId={orden.id} soloLectura={!editando} archivo={archivo} onArchivo={setArchivo} onValidando={setValidando} disabled={ocupado || cargando || !cargaCorrecta} /></div>
    {cargando ? <p role="status" className="py-12 text-center text-sm text-slate-500">Cargando orden médica...</p> : editando ? <form id="form-editar-orden" onSubmit={guardar}><fieldset disabled={ocupado || !cargaCorrecta}><PanelClinico icon={Stethoscope} titulo="Indicación y seguimiento"><div className="space-y-5"><label className={ETIQUETA_CLINICA}>Descripción de la orden <span className="text-blue-600">*</span><textarea rows={4} className={CAMPO_CLINICO + ' resize-y'} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required /></label><label className={ETIQUETA_CLINICA}>Instrucciones clínicas / Posología<textarea rows={4} className={CAMPO_CLINICO + ' resize-y'} value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} /></label><label className={ETIQUETA_CLINICA}>Estado de la orden<select className={CAMPO_CLINICO} value={estado} onChange={(e) => setEstado(e.target.value)}>{ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.titulo}</option>)}</select></label><p className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">Usa “En proceso” al iniciar la atención y “Completada” cuando la indicación se haya realizado.</p></div></PanelClinico></fieldset></form> : <div className="min-w-0 space-y-5"><PanelClinico icon={Stethoscope} titulo="Indicación médica"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{descripcion}</p></PanelClinico><PanelClinico icon={FileText} titulo="Instrucciones clínicas / Posología"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{instrucciones || 'Sin instrucciones adicionales.'}</p></PanelClinico></div>}
    </div>
  </ModalMarco>
}
