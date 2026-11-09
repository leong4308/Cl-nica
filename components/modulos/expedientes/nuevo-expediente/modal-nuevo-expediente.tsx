'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, FileText, Loader2, Pill, Stethoscope } from 'lucide-react'
import { ModalMarco } from '../../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, DatoClinico, ETIQUETA_CLINICA, PanelClinico } from '../../compartidos/editor-clinico'
import { DocumentosClinicos } from '../../compartidos/documentos-clinicos'
import { cargarCitasParaExpediente, guardarExpediente } from '@/lib/supabase/datos'
import { subirDocumentoClinico } from '@/lib/documentos-clinicos'

type Props = { citaIdInicial?: number; onClose: () => void; onSave?: (mensaje: string) => void }
export function ModalNuevoExpediente({ citaIdInicial, onClose, onSave }: Props) {
  const [citas, setCitas] = useState<{ id: number; paciente: string; medico: string; fecha: string; motivo: string }[]>([])
  const [citaId, setCitaId] = useState<number | ''>(citaIdInicial ?? '')
  const [diagnostico, setDiagnostico] = useState('')
  const [receta, setReceta] = useState('')
  const [notas, setNotas] = useState('')
  const [archivo, setArchivo] = useState<File>()
  const [validando, setValidando] = useState(false)
  const [idGuardado, setIdGuardado] = useState<number>()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ocupado = guardando || validando
  useEffect(() => {
    let vigente = true
    cargarCitasParaExpediente().then((res) => {
      if (!vigente) return
      setCitas(res.citas)
      setCitaId(citaIdInicial ?? res.citas[0]?.id ?? '')
      setError(res.error)
      setCargando(false)
    }).catch(() => { if (vigente) { setError('No se pudieron cargar las consultas.'); setCargando(false) } })
    return () => { vigente = false }
  }, [citaIdInicial])
  const cita = citas.find((c) => c.id === Number(citaId))
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (ocupado || !cita || !diagnostico.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const res = await guardarExpediente({ id: idGuardado, citaId: cita.id, diagnostico: diagnostico.trim(), receta: receta.trim(), notas: notas.trim() })
      if (res.error || !res.id) { setError(res.error || 'No se pudo identificar el expediente guardado.'); return }
      setIdGuardado(res.id)
      if (archivo) {
        const fallo = await subirDocumentoClinico('expedientes', res.id, archivo)
        if (fallo) { setError('El expediente se guardó. El PDF sigue pendiente: ' + fallo + ' Puedes reintentar sin crear otro expediente.'); return }
      }
      onSave?.(`Expediente clínico de ${cita.paciente} guardado correctamente`)
      onClose()
    } finally { setGuardando(false) }
  }
  return <ModalMarco title="Nuevo expediente clínico" ancho="max-w-5xl" contenidoFijo onClose={() => { if (!ocupado) onClose() }} footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">El diagnóstico es obligatorio. PDF opcional, hasta 2 MB.</p><div className="flex gap-2"><button type="button" className={BOTON_SECUNDARIO} onClick={onClose} disabled={ocupado}>Cancelar</button><button type="submit" form="form-nuevo-expediente" className={BOTON_PRIMARIO} disabled={ocupado || cargando || !cita || !diagnostico.trim()}>{guardando && <Loader2 size={16} className="animate-spin" />}{guardando ? 'Guardando...' : 'Guardar expediente'}</button></div></div>}>
    <p className="mb-5 text-sm text-slate-500">Organiza el diagnóstico, el tratamiento y la evolución en un solo lugar.</p>
    <AvisoClinico mensaje={error} />
    {cargando ? <p role="status" className="py-12 text-center text-sm text-slate-500">Cargando consultas...</p> : !citas.length ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Primero registra una consulta para vincular el expediente.</p> : <form id="form-nuevo-expediente" onSubmit={guardar}>
      <fieldset disabled={ocupado} className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 space-y-5">
          <PanelClinico icon={CalendarDays} titulo="Consulta del paciente" ayuda="Elige la atención a la que pertenece el expediente." suave>
            <label className={ETIQUETA_CLINICA} htmlFor="exp-cita">Consulta / Cita del paciente</label><select id="exp-cita" className={CAMPO_CLINICO} value={citaId} disabled={Boolean(idGuardado)} onChange={(e) => setCitaId(Number(e.target.value))} required>{citas.map((c) => <option key={c.id} value={c.id}>{c.paciente} · {c.fecha}</option>)}</select>
            {cita && <dl className="mt-5 space-y-4 border-t border-slate-200 pt-4"><DatoClinico etiqueta="Paciente" valor={cita.paciente} /><DatoClinico etiqueta="Médico tratante" valor={cita.medico} /><DatoClinico etiqueta="Fecha de consulta" valor={cita.fecha} /><DatoClinico etiqueta="Motivo de consulta" valor={cita.motivo} /></dl>}
          </PanelClinico>
          <DocumentosClinicos tipo="expedientes" archivo={archivo} onArchivo={setArchivo} onValidando={setValidando} disabled={ocupado} />
        </div>
        <PanelClinico icon={Stethoscope} titulo="Información clínica" ayuda="Registra los hallazgos con el detalle que necesites.">
          <div className="space-y-5"><label className={ETIQUETA_CLINICA}>Diagnóstico médico <span className="text-blue-600">*</span><textarea rows={4} className={CAMPO_CLINICO + ' resize-y'} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} placeholder="Diagnóstico clínico, código CIE o impresión diagnóstica..." required /></label>
          <label className={ETIQUETA_CLINICA}><span className="flex items-center gap-2"><Pill size={16} className="text-blue-600" /> Tratamiento / Receta médica</span><textarea rows={4} className={CAMPO_CLINICO + ' resize-y'} value={receta} onChange={(e) => setReceta(e.target.value)} placeholder="Medicamento, dosis, vía, frecuencia y duración, según corresponda..." /></label>
          <label className={ETIQUETA_CLINICA}><span className="flex items-center gap-2"><FileText size={16} className="text-blue-600" /> Notas clínicas y evolución</span><textarea rows={3} className={CAMPO_CLINICO + ' resize-y'} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Hallazgos, seguimiento y observaciones de la consulta..." /></label></div>
        </PanelClinico>
      </fieldset>
    </form>}
  </ModalMarco>
}
