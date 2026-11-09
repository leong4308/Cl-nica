'use client'

import { useEffect, useState } from 'react'
import { FileText, Loader2, Pill, Stethoscope, UserRound } from 'lucide-react'
import { ModalMarco } from '../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, DatoClinico, ETIQUETA_CLINICA, PanelClinico } from '../compartidos/editor-clinico'
import { DocumentosClinicos } from '../compartidos/documentos-clinicos'
import { cargarExpedientePorId, guardarExpediente } from '@/lib/supabase/datos'
import { subirDocumentoClinico } from '@/lib/documentos-clinicos'

export type ExpedienteEditable = { id: number; paciente: string; motivo: string; diagnostico: string; medico: string; actualizado: string; citaId?: number; receta?: string; notas?: string }
export function ModalDetalleExpediente({ expediente, modo: modoInicial = 'ver', puedeEditar = true, onClose, onSave }: { expediente: ExpedienteEditable; modo?: 'ver' | 'editar'; puedeEditar?: boolean; onClose: () => void; onSave?: (mensaje: string) => void }) {
  const [modo, setModo] = useState(puedeEditar ? modoInicial : 'ver')
  const [datos, setDatos] = useState(expediente)
  const [diagnostico, setDiagnostico] = useState(expediente.diagnostico)
  const [receta, setReceta] = useState(expediente.receta ?? '')
  const [notas, setNotas] = useState(expediente.notas ?? '')
  const [archivo, setArchivo] = useState<File>()
  const [validando, setValidando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [cargaCorrecta, setCargaCorrecta] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ocupado = guardando || validando
  useEffect(() => {
    let vigente = true
    cargarExpedientePorId(expediente.id).then((res) => {
      if (!vigente) return
      if (res.error || !res.expediente) setError(res.error || 'Expediente no encontrado.')
      else { setCargaCorrecta(true); const d = res.expediente; setDatos({ ...expediente, ...d, actualizado: d.fecha }); setDiagnostico(d.diagnostico); setReceta(d.receta); setNotas(d.notas) }
      setCargando(false)
    }).catch(() => { if (vigente) { setError('No se pudo cargar el expediente actual.'); setCargando(false) } })
    return () => { vigente = false }
  }, [expediente.id])
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (ocupado || cargando || !cargaCorrecta || modo !== 'editar' || !puedeEditar || !diagnostico.trim()) return
    setGuardando(true); setError(null)
    try {
      const res = await guardarExpediente({ id: datos.id, citaId: datos.citaId ?? 0, diagnostico: diagnostico.trim(), receta: receta.trim(), notas: notas.trim() })
      if (res.error) { setError(res.error); return }
      if (archivo) { const fallo = await subirDocumentoClinico('expedientes', datos.id, archivo); if (fallo) { setError('Los cambios se guardaron. El PDF sigue pendiente: ' + fallo); return } }
      onSave?.(`Expediente clínico de ${datos.paciente} actualizado correctamente`); onClose()
    } finally { setGuardando(false) }
  }
  const editando = modo === 'editar'
  return <ModalMarco title={editando ? 'Modificar expediente clínico' : 'Expediente clínico'} ancho="max-w-5xl" contenidoFijo onClose={() => { if (!ocupado) onClose() }} footer={<div className="flex flex-wrap justify-between gap-3"><button type="button" className={BOTON_SECUNDARIO} onClick={onClose} disabled={ocupado}>{editando ? 'Cancelar' : 'Cerrar'}</button>{editando ? <button key="guardar" type="submit" form="form-editar-expediente" className={BOTON_PRIMARIO} disabled={ocupado || cargando || !cargaCorrecta || !diagnostico.trim()}>{guardando && <Loader2 size={16} className="animate-spin" />}{guardando ? 'Guardando...' : 'Guardar cambios'}</button> : puedeEditar && <button key="editar" type="button" className={BOTON_PRIMARIO} onClick={(event) => { event.preventDefault(); setModo('editar') }} disabled={cargando || !cargaCorrecta}>Editar expediente</button>}</div>}>
    <p className="mb-5 text-sm text-slate-500">{editando ? 'Actualiza la información de esta consulta y sus documentos.' : 'Consulta el diagnóstico, el tratamiento y el seguimiento del paciente.'}</p><AvisoClinico mensaje={error} />
    <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)]">
      <div className="min-w-0 space-y-5"><PanelClinico icon={UserRound} titulo={datos.paciente} ayuda={`Expediente #${datos.id}`} suave><dl className="space-y-4"><DatoClinico etiqueta="Médico tratante" valor={datos.medico} /><DatoClinico etiqueta="Fecha de consulta" valor={datos.actualizado} /><DatoClinico etiqueta="Motivo de consulta" valor={datos.motivo} /></dl></PanelClinico><DocumentosClinicos tipo="expedientes" registroId={datos.id} soloLectura={!editando} archivo={archivo} onArchivo={setArchivo} onValidando={setValidando} disabled={ocupado || cargando || !cargaCorrecta} /></div>
      {cargando ? <p role="status" className="py-12 text-center text-sm text-slate-500">Cargando expediente...</p> : editando ? <form id="form-editar-expediente" onSubmit={guardar}><fieldset disabled={ocupado || !cargaCorrecta} className="space-y-5"><PanelClinico icon={Stethoscope} titulo="Información clínica"><div className="space-y-5"><label className={ETIQUETA_CLINICA}>Diagnóstico clínico <span className="text-blue-600">*</span><textarea rows={4} className={CAMPO_CLINICO + ' resize-y'} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} required /></label><label className={ETIQUETA_CLINICA}>Tratamiento / Receta médica<textarea rows={4} className={CAMPO_CLINICO + ' resize-y'} value={receta} onChange={(e) => setReceta(e.target.value)} /></label><label className={ETIQUETA_CLINICA}>Notas clínicas y evolución<textarea rows={3} className={CAMPO_CLINICO + ' resize-y'} value={notas} onChange={(e) => setNotas(e.target.value)} /></label></div></PanelClinico></fieldset></form> : <div className="min-w-0 space-y-4">{[{ icon: Stethoscope, titulo: 'Diagnóstico clínico', valor: diagnostico }, { icon: Pill, titulo: 'Tratamiento / Receta médica', valor: receta }, { icon: FileText, titulo: 'Notas clínicas y evolución', valor: notas }].map((item) => <PanelClinico key={item.titulo} icon={item.icon} titulo={item.titulo}><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{item.valor || 'Sin información registrada.'}</p></PanelClinico>)}</div>}
    </div>
  </ModalMarco>
}
