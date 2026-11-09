'use client'

import { useState } from 'react'
import { BedDouble, ClipboardList, Search, UserRound } from 'lucide-react'
import { CAMPO_CLINICO, ETIQUETA_CLINICA, PanelClinico } from '../compartidos/editor-clinico'
import { ubicacionHospital, type DatosHospital, type IngresoHospital } from '@/lib/internacion/modelo'

export type BorradorIngreso = { pacienteId: number | ''; medicoId: number | ''; camaId: number | ''; motivo: string; diagnostico: string; notaCambio: string }
export const INGRESO_VACIO: BorradorIngreso = { pacienteId: '', medicoId: '', camaId: '', motivo: '', diagnostico: '', notaCambio: '' }
export function FormularioIngreso({ datos, borrador, onChange, ingreso, disabled = false }: { datos: DatosHospital; borrador: BorradorIngreso; onChange: (valor: BorradorIngreso) => void; ingreso?: IngresoHospital; disabled?: boolean }) {
  const [busqueda, setBusqueda] = useState('')
  const [habitacion, setHabitacion] = useState('todas')
  const cerrado = ingreso && ingreso.estado !== 'activa'
  const medico = datos.medicos.find((m) => m.id === Number(borrador.medicoId))
  const clinicaId = ingreso?.clinicaId ?? medico?.clinicaId
  const candidatas = datos.camas.filter((cama) => (!clinicaId || cama.clinicaId === clinicaId) && (!cama.ocupada || cama.id === ingreso?.camaId))
  const habitaciones = [...new Set(candidatas.map((cama) => cama.habitacion))]
  const seleccionada = datos.camas.find((cama) => cama.id === Number(borrador.camaId))
  const visibles = candidatas.filter((cama) => (habitacion === 'todas' || cama.habitacion === habitacion) && `${cama.numero} ${cama.habitacion} ${cama.tipo}`.toLowerCase().includes(busqueda.toLowerCase()))
  function cambiar<K extends keyof BorradorIngreso>(campo: K, valor: BorradorIngreso[K]) { onChange({ ...borrador, [campo]: valor }) }
  return <fieldset disabled={disabled} className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <div className="min-w-0 space-y-5">
      <PanelClinico icon={UserRound} titulo="Paciente y responsable" ayuda={ingreso ? 'Datos vinculados a esta hospitalización.' : 'Elige a quién se interna y quién estará a cargo.'} suave>
        <div className="space-y-4">
          {ingreso ? <div><p className="text-xs text-slate-500">Paciente</p><p className="mt-2 text-base font-semibold text-slate-900">{ingreso.paciente}</p></div> : <label className={ETIQUETA_CLINICA}>Paciente a internar<select aria-label="Paciente a internar" className={CAMPO_CLINICO} value={borrador.pacienteId} onChange={(e) => cambiar('pacienteId', Number(e.target.value))} required><option value="" disabled>Selecciona un paciente</option>{datos.pacientes.filter((p) => !p.ingresoActivo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select><span className="mt-2 block text-xs font-normal text-slate-500">Se muestran pacientes activos sin otra hospitalización en curso.</span></label>}
          <label className={ETIQUETA_CLINICA}>Médico responsable<select aria-label="Médico responsable" className={CAMPO_CLINICO} value={borrador.medicoId} onChange={(e) => { const id = Number(e.target.value); const nuevo = datos.medicos.find((m) => m.id === id); onChange({ ...borrador, medicoId: id, camaId: seleccionada && seleccionada.clinicaId !== nuevo?.clinicaId ? '' : borrador.camaId }) }} required><option value="" disabled>Selecciona al médico</option>{ingreso && !datos.medicos.some((m) => m.id === ingreso.medicoId) && <option value={ingreso.medicoId}>{ingreso.medico} · registro original</option>}{datos.medicos.filter((m) => !ingreso || m.clinicaId === ingreso.clinicaId).map((m) => <option key={m.id} value={m.id}>{m.nombre} · {m.especialidad}</option>)}</select></label>
        </div>
      </PanelClinico>
      <PanelClinico icon={ClipboardList} titulo="Información de ingreso" ayuda="Registra el motivo y los datos clínicos disponibles.">
        <div className="space-y-4"><label className={ETIQUETA_CLINICA}>Motivo del internamiento <span className="text-blue-600">*</span><textarea rows={3} className={CAMPO_CLINICO + ' resize-y'} value={borrador.motivo} onChange={(e) => cambiar('motivo', e.target.value)} maxLength={8000} required placeholder="Motivo por el que se solicita hospitalización..." /></label><label className={ETIQUETA_CLINICA}>Diagnóstico de ingreso / Observaciones<textarea rows={3} className={CAMPO_CLINICO + ' resize-y'} value={borrador.diagnostico} onChange={(e) => cambiar('diagnostico', e.target.value)} maxLength={8000} placeholder="Hallazgos y observaciones al ingreso..." /></label>{ingreso && <label className={ETIQUETA_CLINICA}>{cerrado ? 'Motivo de la corrección *' : 'Nota del cambio o traslado'}<textarea rows={2} className={CAMPO_CLINICO + ' resize-y'} value={borrador.notaCambio} onChange={(e) => cambiar('notaCambio', e.target.value)} required={Boolean(cerrado)} maxLength={8000} placeholder="Describe el cambio para dejar constancia en los movimientos..." /></label>}</div>
      </PanelClinico>
    </div>
    <div className="min-w-0 space-y-5">
      <PanelClinico icon={BedDouble} titulo="Asignación de cama" ayuda={cerrado ? 'Ubicación registrada al cierre del ingreso.' : 'Selecciona una cama libre de la clínica del médico.'}>
        {cerrado ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm font-semibold text-slate-800">{ubicacionHospital(ingreso.habitacion, ingreso.cama)}</p><p className="mt-3 text-sm leading-relaxed text-slate-500">El ingreso está cerrado. La corrección de datos conserva la ubicación histórica y no vuelve a ocupar esta cama.</p></div> : <>
          <div className="mb-4 grid min-w-0 gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Buscar cama<span className="relative mt-2 block"><Search size={15} className="absolute left-3 top-3.5 text-slate-400" /><input type="search" className={CAMPO_CLINICO + ' !mt-0 pl-9'} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Cama o tipo..." /></span></label><label className="text-xs font-semibold text-slate-600">Habitación<select aria-label="Filtrar habitación" className={CAMPO_CLINICO} value={habitacion} onChange={(e) => setHabitacion(e.target.value)}><option value="todas">Todas las habitaciones</option>{habitaciones.map((numero) => <option key={numero}>{numero}</option>)}</select></label></div>
          <p className="mb-3 text-xs text-slate-500">{candidatas.filter((c) => !c.ocupada).length} camas disponibles{ingreso ? ' · también puedes conservar la cama actual' : ''}</p>
          <div className="grid max-h-80 min-w-0 gap-3 overflow-y-auto p-1 sm:grid-cols-2" role="radiogroup" aria-label="Camas disponibles">{visibles.map((cama) => <label key={cama.id} className={'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-blue-500 ' + (borrador.camaId === cama.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300')}><input type="radio" name="cama-ingreso" value={cama.id} checked={borrador.camaId === cama.id} onChange={() => cambiar('camaId', cama.id)} className="mt-1 shrink-0 accent-blue-600" /><span className="min-w-0"><span className="block break-words text-sm font-semibold text-slate-800">Cama {cama.numero}</span><span className="mt-1 block text-xs text-slate-500">Habitación {cama.habitacion} · {cama.tipo}</span><span className={'mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-medium ' + (cama.id === ingreso?.camaId ? 'bg-blue-100 text-blue-800' : 'bg-emerald-50 text-emerald-700')}>{cama.id === ingreso?.camaId ? 'Cama actual' : 'Disponible'}</span></span></label>)}</div>
          {!visibles.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No hay camas disponibles con esos filtros.</p>}
          {seleccionada && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4"><p className="text-xs font-semibold text-blue-700">Cama seleccionada</p><p className="mt-2 break-words text-sm font-semibold text-slate-800">{ubicacionHospital(seleccionada.habitacion, seleccionada.numero)}</p></div>}
        </>}
      </PanelClinico>
    </div>
  </fieldset>
}
