'use client'

import { useId, useState } from 'react'
import { CalendarDays, ChevronDown, Clock3, FileText, History, Loader2, Pill, Search, Stethoscope, UsersRound } from 'lucide-react'
import type { HistorialPaciente } from '@/lib/supabase/datos'
import { BOTON_SECUNDARIO, CAMPO_CLINICO } from '../compartidos/editor-clinico'

const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
export function HistorialClinicoPaciente({ historial, cargando, error, onReintentar }: { historial: HistorialPaciente[] | null; cargando: boolean; error: string | null; onReintentar: () => void }) {
  const [busqueda, setBusqueda] = useState('')
  const [medico, setMedico] = useState('todos')
  const [orden, setOrden] = useState('recientes')
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const prefijo = useId()
  const registros = (historial ?? []).map((item, indice) => ({ ...item, indice, clave: String(item.id ?? `${item.fecha}-${indice}`) }))
  const medicos = [...new Set(registros.map((item) => item.medico).filter((nombre) => nombre && nombre !== '—'))]
  const consulta = normalizar(busqueda.trim())
  const filtrados = registros.filter((item) => (medico === 'todos' || item.medico === medico) && normalizar(`${item.motivo} ${item.diagnostico} ${item.receta} ${item.notas} ${item.medico} ${item.fecha}`).includes(consulta))
    .sort((a, b) => {
      const fechaA = Date.parse(a.fechaIso ?? '')
      const fechaB = Date.parse(b.fechaIso ?? '')
      const diferencia = Number.isNaN(fechaA) || Number.isNaN(fechaB) ? a.indice - b.indice : fechaB - fechaA
      return orden === 'recientes' ? diferencia : -diferencia
    })
  const ultima = [...registros].sort((a, b) => (Date.parse(b.fechaIso ?? '') || 0) - (Date.parse(a.fechaIso ?? '') || 0))[0]

  return <section aria-label="Historial de consultas" className="space-y-5">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-600"><History size={21} /></span><div><h4 className="text-lg font-semibold text-slate-900">Seguimiento clínico</h4><p className="mt-1 text-sm leading-relaxed text-slate-500">Recorre las consultas y revisa los diagnósticos, tratamientos y notas de evolución.</p></div></div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><span>{error}</span><button type="button" onClick={onReintentar} disabled={cargando} className={BOTON_SECUNDARIO}>Volver a cargar</button></div>}
    {cargando && !historial?.length ? <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-12 text-sm text-slate-500"><Loader2 size={20} className="animate-spin" />Cargando historial clínico...</div> : <>
      <dl className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4"><dt className="flex items-center gap-2 text-xs text-blue-700"><FileText size={15} />Consultas mostradas</dt><dd className="mt-2 text-2xl font-semibold text-slate-900">{registros.length}</dd></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><dt className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={15} />Última consulta</dt><dd className="mt-3 text-sm font-semibold text-slate-900">{ultima?.fecha || 'Sin consultas'}</dd></div>
        <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 sm:block"><dt className="flex items-center gap-2 text-xs text-slate-500"><UsersRound size={15} />Médicos tratantes</dt><dd className="mt-2 text-2xl font-semibold text-slate-900">{medicos.length}</dd></div>
      </dl>
      {registros.length > 0 && <div className="grid min-w-0 grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="col-span-2 block min-w-0 text-xs font-semibold text-slate-600 lg:col-span-1">Buscar en el historial<span className="relative mt-2 block"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input type="search" className={CAMPO_CLINICO + ' !mt-0 pl-9'} value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Diagnóstico, tratamiento, médico..." /></span></label>
        <label className="min-w-0 text-xs font-semibold text-slate-600">Médico tratante<select aria-label="Médico tratante" className={CAMPO_CLINICO} value={medico} onChange={(event) => setMedico(event.target.value)}><option value="todos">Todos los médicos</option>{medicos.map((nombre) => <option key={nombre}>{nombre}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-slate-600">Orden de consultas<select aria-label="Orden de consultas" className={CAMPO_CLINICO} value={orden} onChange={(event) => setOrden(event.target.value)}><option value="recientes">Más recientes primero</option><option value="antiguos">Más antiguas primero</option></select></label>
      </div>}
      {registros.length === 0 && !error ? <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center"><CalendarDays size={30} className="mx-auto mb-3 text-blue-400" /><p className="font-semibold text-slate-800">El historial comienza con su primera consulta</p><p className="mt-2 text-sm text-slate-500">Aquí aparecerán los expedientes registrados durante la atención del paciente.</p></div> : registros.length > 0 && filtrados.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><p className="text-sm font-semibold text-slate-700">No encontramos consultas con esos filtros</p><button type="button" className="mt-3 text-sm font-medium text-blue-600 hover:underline" onClick={() => { setBusqueda(''); setMedico('todos') }}>Limpiar filtros</button></div> : <>
        {registros.length > 0 && <p aria-live="polite" className="text-xs text-slate-500">{filtrados.length} de {registros.length} consultas · {orden === 'recientes' ? 'De la más reciente a la más antigua' : 'De la más antigua a la más reciente'}</p>}
        <ol className="relative space-y-5 before:absolute before:bottom-6 before:left-5 before:top-6 before:w-px before:bg-blue-100 sm:before:left-7">
          {filtrados.map((item) => {
            const fecha = item.fechaIso && !Number.isNaN(Date.parse(item.fechaIso)) ? new Date(item.fechaIso) : null
            const abierto = expandidos[item.clave] ?? item.indice === 0
            const panelId = `${prefijo}-${item.indice}`
            return <li key={item.clave} className="relative grid min-w-0 grid-cols-[42px_minmax(0,1fr)] gap-3 sm:grid-cols-[58px_minmax(0,1fr)] sm:gap-4">
              <div className="z-10 flex h-16 flex-col items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700 shadow-sm">{fecha ? <><span className="text-xl font-semibold">{fecha.toLocaleDateString('es-MX', { day: '2-digit', timeZone: 'America/Mexico_City' })}</span><span className="text-[10px] font-semibold uppercase">{fecha.toLocaleDateString('es-MX', { month: 'short', timeZone: 'America/Mexico_City' })}</span></> : <CalendarDays size={20} />}</div>
              <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><h5 className="min-w-0 break-words text-base font-semibold text-slate-900">{item.motivo}</h5><time dateTime={item.fechaIso} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{item.fecha}</time></div><p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Stethoscope size={15} className="shrink-0 text-blue-500" /><span className="break-words">{item.medico}</span></p></div>
                <div className="p-4 sm:p-5"><div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-700"><Stethoscope size={15} />Diagnóstico clínico</p><p className={'whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 ' + (!abierto ? 'line-clamp-2' : '')}>{item.diagnostico || 'Sin diagnóstico registrado.'}</p></div>
                  {abierto && <div id={panelId} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2"><div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"><h6 className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-800"><Pill size={15} />Tratamiento / Receta</h6><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{item.receta || 'Sin tratamiento registrado.'}</p></div><div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4"><h6 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><FileText size={15} />Evolución y notas</h6><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{item.notas || 'Sin notas adicionales.'}</p></div></div>}
                  <button type="button" aria-expanded={abierto} aria-controls={panelId} className="mt-4 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50" onClick={() => setExpandidos((prev) => ({ ...prev, [item.clave]: !abierto }))}><ChevronDown size={16} className={abierto ? 'rotate-180' : ''} />{abierto ? 'Ocultar tratamiento y notas' : 'Ver tratamiento y notas'}</button>
                </div>
              </article>
            </li>
          })}
        </ol>
      </>}
    </>}
  </section>
}
