'use client'

import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { appointments } from '../../compartidos/data'
import type { ClinicActions } from '../../compartidos/types'
import { RowActions } from '../../compartidos/ui'

const filters = ['Actuales', 'Pendientes', 'Reagendar']

export function ProximasCitas({ ahora, notify, openModal, navigate }: ClinicActions & { ahora: Date }) {
  const [filtroActivo, setFiltroActivo] = useState('Actuales')
  const [citasAgregadas, setCitasAgregadas] = useState<typeof appointments>([])

  useEffect(() => {
    const recibirCita = (event: Event) => setCitasAgregadas((actuales) => [...actuales, (event as CustomEvent<typeof appointments[number]>).detail])
    window.addEventListener('cita-creada', recibirCita)
    return () => window.removeEventListener('cita-creada', recibirCita)
  }, [])

  const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes()
  const convertirHora = (minutosTotales: number) => {
    const minutos = (minutosTotales + 1440) % 1440
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
  }
  const citasDemo = [...appointments, ...citasAgregadas].map((cita, indice) => indice === 0
    ? [convertirHora(ahoraMinutos - 5), cita[1], cita[2], cita[3], cita[4]] as typeof appointments[number]
    : indice === 1
      ? [convertirHora(ahoraMinutos - 15), cita[1], cita[2], cita[3], cita[4]] as typeof appointments[number]
      : cita)
  const estadoCalculado = (cita: typeof appointments[number]) => {
    const [horas, minutos] = cita[0].split(':').map(Number)
    const minutosTranscurridos = ahoraMinutos - (horas * 60 + minutos)
    if (cita[4] === 'Atendida' || minutosTranscurridos < 0) return cita[4]
    if (minutosTranscurridos <= 10) return 'Pendiente'
    return 'Reagendar'
  }
  const citasActuales = citasDemo.filter((cita) => estadoCalculado(cita) !== 'Pendiente' && estadoCalculado(cita) !== 'Reagendar')
  const citasFiltradas = filtroActivo === 'Actuales'
    ? citasActuales.slice(0, 1)
    : citasDemo.filter((cita) => estadoCalculado(cita) === (filtroActivo === 'Pendientes' ? 'Pendiente' : filtroActivo))
  const formatearHora = (valor: string) => {
    const [horas, minutos] = valor.split(':').map(Number)
    const periodo = horas >= 12 ? 'PM' : 'AM'
    const hora12 = horas % 12 || 12
    return `${hora12}:${String(minutos).padStart(2, '0')} ${periodo}`
  }


  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="text-sm font-bold">Próximas citas y check-in</h3><p className="mt-0.5 text-xs text-slate-400">Confirmación presencial y control de turno</p></div>
          <button type="button" onClick={() => navigate('Citas')} className="hidden text-xs font-semibold text-blue-600 sm:block">Ver agenda completa →</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 pb-1">
          {filters.filter((filter) => filter !== 'Reagendar').map((filter) => { const cantidad = filter === 'Actuales' ? citasActuales.length : citasDemo.filter((cita) => estadoCalculado(cita) === (filter === 'Pendientes' ? 'Pendiente' : filter)).length; return <button type="button" key={filter} onClick={() => setFiltroActivo(filter)} aria-pressed={filtroActivo === filter} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${filtroActivo === filter ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700'}`}>{filter} ({cantidad})</button> })}
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
          {(() => { const cantidad = citasDemo.filter((cita) => estadoCalculado(cita) === 'Reagendar').length; return <button type="button" onClick={() => setFiltroActivo('Reagendar')} aria-pressed={filtroActivo === 'Reagendar'} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${filtroActivo === 'Reagendar' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Reagendar ({cantidad})</button> })()}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {citasFiltradas.slice(0, 4).map((row, index) => { const estado = estadoCalculado(row); const necesitaReagenda = estado === 'Reagendar'; const estaPendiente = estado === 'Pendiente'; return <div className={`grid gap-3 px-4 py-3 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center ${necesitaReagenda ? 'border-l-4 border-red-400 bg-red-50/40' : estaPendiente ? 'border-l-4 border-amber-300 bg-amber-50/40' : ''}`} key={index}>
              <div className="flex items-center gap-2"><Clock3 className={`size-4 ${necesitaReagenda ? 'text-red-500' : estaPendiente ? 'text-amber-500' : 'text-slate-400'}`} /><span className="text-xs font-bold leading-tight">{formatearHora(row[0])}</span></div>
              <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{row[1]}</p><p className="truncate text-[11px] text-slate-500">{row[2]} · {row[3]}</p></div>
              <div className="flex flex-wrap items-center justify-end gap-1.5"><RowActions onView={() => openModal(`Detalle de ${row[1]}`)} onEdit={() => openModal(`Editar cita de ${row[1]}`)} />{filtroActivo !== 'Reagendar' && <><button type="button" onClick={() => notify(`Cita de ${row[1]} confirmada`)} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100">Confirmar</button><button type="button" onClick={() => openModal(`Reagendar cita de ${row[1]}`)} className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100">Reagendar</button></>}{filtroActivo === 'Reagendar' && <button type="button" onClick={() => openModal(`Reagendar cita de ${row[1]}`)} className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100">Reagendar</button>}</div>
            </div> })}
        {citasFiltradas.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-400">No hay citas en esta categoría.</div>}
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">{filtroActivo === 'Actuales' ? 'Mostrando la próxima cita' : `Mostrando ${citasFiltradas.length} de ${citasFiltradas.length} citas programadas`}</div>
    </div>
  )
}
