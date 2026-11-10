'use client'

import { useId, useState } from 'react'
import { Pill, Plus, Trash2 } from 'lucide-react'
import type { MedicamentoPrescrito } from './types'
import { VADEMECUM_POPULAR } from './datos-medicos'
import { BOTON_SECUNDARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '../compartidos/editor-clinico'

export function PrescripcionReceta({ prescripciones, onActualizarPrescripciones }: {
  prescripciones: MedicamentoPrescrito[]
  onActualizarPrescripciones: (nuevas: MedicamentoPrescrito[]) => void
}) {
  const catalogoId = useId()
  const [nombre, setNombre] = useState('')
  const [indicaciones, setIndicaciones] = useState('')
  const [presentacion, setPresentacion] = useState('')

  function agregar() {
    if (!nombre.trim() || !indicaciones.trim()) return
    onActualizarPrescripciones([...prescripciones, {
      id: crypto.randomUUID(), nombre: nombre.trim(), tipo: 'Nuevo',
      posologia: indicaciones.trim(), presentacion: presentacion.trim(),
    }])
    setNombre(''); setIndicaciones(''); setPresentacion('')
  }
  function modificar(id: string, cambios: Partial<MedicamentoPrescrito>) {
    onActualizarPrescripciones(prescripciones.map((p) => p.id === id ? { ...p, ...cambios } : p))
  }
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Pill size={17} className="text-blue-600" />Receta médica</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Registra el medicamento y sus indicaciones. La dosis, frecuencia y duración las define el profesional.</p>
      </div>
      <div className="space-y-3 rounded-xl bg-slate-50 p-4">
        <label className={ETIQUETA_CLINICA}>Medicamento<input aria-label="Medicamento" list={catalogoId} className={CAMPO_CLINICO} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre o principio activo" /></label>
        <datalist id={catalogoId}>{VADEMECUM_POPULAR.map((m) => <option key={m.nombre} value={m.nombre} />)}</datalist>
        <label className={ETIQUETA_CLINICA}>Indicaciones<textarea aria-label="Indicaciones del medicamento" rows={2} className={CAMPO_CLINICO} value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} placeholder="Dosis, vía, frecuencia y duración indicadas" /></label>
        <label className={ETIQUETA_CLINICA}>Presentación (opcional)<input aria-label="Presentación del medicamento" className={CAMPO_CLINICO} value={presentacion} onChange={(e) => setPresentacion(e.target.value)} placeholder="Presentación o cantidad" /></label>
        <button type="button" className={BOTON_SECUNDARIO} disabled={!nombre.trim() || !indicaciones.trim()} onClick={agregar}><Plus size={16} />Agregar a la receta</button>
      </div>
      {!prescripciones.length ? <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">Aún no hay medicamentos en esta receta.</p> : (
        <div className="space-y-4">{prescripciones.map((p, i) => (
          <div key={p.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">Medicamento {i + 1}</p><button type="button" aria-label={`Eliminar medicamento ${i + 1}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => onActualizarPrescripciones(prescripciones.filter((m) => m.id !== p.id))}><Trash2 size={16} /></button></div>
            {p.textoOriginal !== undefined ? <label className={ETIQUETA_CLINICA}>Receta previa (texto libre)<textarea className={CAMPO_CLINICO} rows={3} value={p.textoOriginal} onChange={(e) => modificar(p.id, { nombre: e.target.value, textoOriginal: e.target.value })} /></label> : <>
              <label className={ETIQUETA_CLINICA}>Nombre<input aria-label={`Nombre del medicamento ${i + 1}`} className={CAMPO_CLINICO} value={p.nombre} onChange={(e) => modificar(p.id, { nombre: e.target.value })} /></label>
              <label className={ETIQUETA_CLINICA}>Indicaciones<textarea aria-label={`Indicaciones del medicamento ${i + 1}`} className={CAMPO_CLINICO} rows={2} value={p.posologia} onChange={(e) => modificar(p.id, { posologia: e.target.value })} /></label>
              <label className={ETIQUETA_CLINICA}>Presentación<input aria-label={`Presentación del medicamento ${i + 1}`} className={CAMPO_CLINICO} value={p.presentacion} onChange={(e) => modificar(p.id, { presentacion: e.target.value })} /></label>
            </>}
          </div>
        ))}</div>
      )}
    </section>
  )
}
