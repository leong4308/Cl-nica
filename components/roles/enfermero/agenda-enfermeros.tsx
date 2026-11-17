'use client'

import { useRef, useState } from 'react'
import { CalendarDays, ClipboardList, Plus, UserRound, UsersRound } from 'lucide-react'
import type { PanelEnfermeriaDatos } from '@/lib/enfermeria/modelo'
import { fechaEnfermeria } from '@/lib/enfermeria/modelo'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO } from '@/components/modulos/compartidos/editor-clinico'

export function AgendaEnfermeros({ datos, onAsignar, onVerPaciente, onRetirar }: {
  datos: PanelEnfermeriaDatos
  onAsignar: (enfermeroId?: number) => void
  onVerPaciente: (pacienteId: number) => void
  onRetirar: (turnoId: number, pacienteId: number) => void
}) {
  const [seleccion, setSeleccion] = useState('todos')
  const detalle = useRef<HTMLElement>(null)
  const ahora = Date.parse(datos.servidorAhora)
  const enfermeros = [...datos.enfermeros].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const elegido = enfermeros.find(e => String(e.id) === seleccion)
  const vigentes = datos.turnos.filter(t => Date.parse(t.fin) > ahora).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
  const turnos = vigentes.filter(t => !elegido || t.enfermero_id === elegido.id)
  const pacientes = new Map(datos.pacientes.map(p => [p.id, p.nombre]))
  function consultar(id: number) { setSeleccion(String(id)); detalle.current?.focus() }
  return <div className="space-y-5">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div><p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={17} className="text-teal-700" />Personal de enfermería</p><p className="mt-2 text-xs text-slate-500">{new Date(datos.servidorAhora).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long' })} · {enfermeros.length} enfermero(s) activo(s)</p></div>
      <button type="button" className={BOTON_PRIMARIO} disabled={!enfermeros.length || !datos.pacientes.length} onClick={() => onAsignar(elegido?.id)}><Plus size={16} />Asignar turno</button>
    </section>
    <div aria-label="Enfermeros y asignaciones" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {enfermeros.map(e => {
        const asignaciones = vigentes.filter(t => t.enfermero_id === e.id)
        const actuales = asignaciones.filter(t => Date.parse(t.inicio) <= ahora)
        const cantidad = new Set(actuales.map(t => t.paciente_id)).size
        const proxima = asignaciones.find(t => Date.parse(t.inicio) > ahora)
        const areas = [...new Set(actuales.map(t => t.area))]
        const intervalos = [...new Map(asignaciones.map(t => [`${t.inicio}:${t.fin}`, t])).values()]
        return <article key={e.id} aria-label={`Enfermero ${e.nombre}`} className={`flex min-w-0 flex-col rounded-2xl border bg-white p-5 ${elegido?.id === e.id ? 'border-teal-600 ring-1 ring-teal-100' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-teal-700">Enfermería</p><UserRound size={19} className="text-teal-700" /></div>
          <h3 className="mt-2 text-lg font-semibold">{e.nombre}</h3>
          <span className={`mt-3 w-fit rounded-full px-3 py-1 text-xs font-medium ${cantidad ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>{cantidad ? 'Con pacientes asignados ahora' : 'Sin asignación vigente'}</span>
          <p className="mt-4 flex items-center gap-2 text-sm"><UsersRound size={16} className="text-slate-400" />{cantidad} paciente(s) en atención</p>
          {areas.length > 0 && <p className="mt-2 text-xs text-slate-500">Área: {areas.join(' · ')}</p>}
          <p className="mt-4 text-xs text-slate-500">Turnos vigentes y próximos</p>
          {intervalos.length ? <ul className="mt-2 space-y-2 text-sm">{intervalos.slice(0, 2).map(t => <li key={t.id}>{fechaEnfermeria(t.inicio)} – {fechaEnfermeria(t.fin)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Sin turnos asignados en los próximos siete días.</p>}
          {intervalos.length > 2 && <p className="mt-2 text-xs text-slate-500">{intervalos.length - 2} horario(s) adicional(es) en sus asignaciones.</p>}
          {!cantidad && proxima && <p className="mt-3 text-xs text-teal-700">Próximo turno: {fechaEnfermeria(proxima.inicio)}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-5"><button type="button" className={BOTON_SECUNDARIO} onClick={() => consultar(e.id)}>{elegido?.id === e.id ? 'Mostrando sus asignaciones' : 'Consultar asignaciones'}</button><button type="button" className={BOTON_SECUNDARIO} disabled={!datos.pacientes.length} onClick={() => onAsignar(e.id)}>Asignar paciente</button></div>
        </article>
      })}
    </div>
    {!enfermeros.length && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">No hay enfermeros activos registrados. Activa o registra una cuenta de enfermería desde Usuarios.</p>}
    <p className="text-xs leading-relaxed text-slate-500">La disponibilidad se basa en las asignaciones registradas. Un enfermero activo sin asignaciones no tiene una guardia confirmada. Puedes asignarle varios pacientes en el mismo turno.</p>
    <section ref={detalle} tabIndex={-1} aria-label="Asignaciones del personal de enfermería" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><ClipboardList size={18} className="text-teal-700" />{elegido ? `Asignaciones de ${elegido.nombre}` : 'Asignaciones de los pacientes'}</h3><span className="text-xs text-slate-500">{turnos.length} asignación(es)</span></div>
      <label className="mt-5 block max-w-sm text-sm font-medium">Enfermero<select aria-label="Filtrar enfermero" value={elegido ? String(elegido.id) : 'todos'} onChange={e => setSeleccion(e.target.value)} className={CAMPO_CLINICO}><option value="todos">Todos los enfermeros activos</option>{enfermeros.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>
      {!turnos.length ? <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No hay pacientes asignados a turnos vigentes o próximos para esta selección.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="px-2 py-3">Paciente</th><th className="px-2 py-3">Enfermero / área</th><th className="px-2 py-3">Horario · Ciudad de México</th><th className="px-2 py-3">Acciones</th></tr></thead><tbody>{turnos.map(t => <tr key={t.id} className="border-b border-slate-100"><td className="px-2 py-4 font-medium">{pacientes.get(t.paciente_id) ?? `Paciente #${t.paciente_id}`}</td><td className="px-2 py-4">{t.enfermero}<span className="mt-1 block text-xs text-slate-500">{t.area}</span></td><td className="px-2 py-4"><p>{fechaEnfermeria(t.inicio)} – {fechaEnfermeria(t.fin)}</p><span className="mt-1 block text-xs text-teal-700">{Date.parse(t.inicio) <= ahora ? 'En curso' : 'Programado'}</span></td><td className="px-2 py-4"><div className="flex flex-wrap gap-2"><button type="button" className={BOTON_SECUNDARIO} onClick={() => onVerPaciente(t.paciente_id)}>Ver seguimiento</button><button type="button" className={BOTON_SECUNDARIO} onClick={() => onRetirar(t.id, t.paciente_id)}>Retirar asignación</button></div></td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
