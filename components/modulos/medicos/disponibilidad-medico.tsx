'use client'

import { useState } from 'react'
import { Clock3 } from 'lucide-react'
import { horaClinica, type ResumenAgenda } from '@/lib/agenda/modelo'

const fechaTexto = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short' })
export function DisponibilidadMedico({ resumen, fecha, cargando }: { resumen: ResumenAgenda | null; fecha: string; cargando: boolean }) {
  const [verTodos, setVerTodos] = useState(false)
  const [abierta, setAbierta] = useState(false)
  const slots = resumen?.dias[0]?.slots ?? []
  const porcentaje = resumen?.jornadaMinutos ? Math.round(resumen.ocupadosMinutos / resumen.jornadaMinutos * 100) : null
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-busy={cargando}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Clock3 size={17} className="text-blue-600" />Disponibilidad del médico</h3>
      <button type="button" className="mt-3 text-xs font-semibold text-blue-600 sm:hidden" aria-expanded={abierta} onClick={() => setAbierta(!abierta)}>{abierta ? 'Ocultar horarios y descansos' : 'Ver horarios y descansos'}</button>
      <div className={(abierta ? 'block' : 'hidden') + ' sm:block'}>
      {cargando ? <p role="status" className="mt-4 text-sm text-slate-500">Consultando disponibilidad...</p> : !resumen ? <p className="mt-4 text-sm text-slate-500">No se pudo consultar. Usa Actualizar para reintentar.</p> : <>
        <p className="mt-2 text-xs text-slate-500">Consultas de {resumen.duracionConsulta} min · Ciudad de México</p>
        {porcentaje !== null && <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Jornada reservada</span><strong className="text-slate-800">{porcentaje}%</strong></div>
          <div role="meter" aria-label="Jornada reservada" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${porcentaje}%` }} /></div>
          <p className="mt-2 text-[11px] text-slate-500">{resumen.ocupadosMinutos} de {resumen.jornadaMinutos} minutos programados</p>
        </div>}
        <dl className="mt-4 space-y-4">
          <div><dt className="text-xs text-slate-500">Próximo intervalo disponible</dt><dd className="mt-1 text-sm font-semibold text-emerald-700">{resumen.proximo ? `${fechaTexto(resumen.proximo.inicio)} · ${resumen.proximo.hora} – ${resumen.proximo.finHora}` : resumen.configurado ? 'Sin intervalos libres en 7 días' : 'Horario aún no publicado'}</dd></div>
          <div><dt className="text-xs text-slate-500">Próxima cita agendada · próximos 7 días</dt><dd className="mt-1 text-sm font-medium text-slate-800">{resumen.proximaCita ? `${fechaTexto(resumen.proximaCita.inicio)} · ${horaClinica(resumen.proximaCita.inicio)} – ${horaClinica(resumen.proximaCita.fin)}` : 'Sin citas futuras en este rango'}</dd></div>
        </dl>
        {resumen.configurado ? <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-600">Intervalos libres del día ({slots.length})</p>
          <div className="mt-2 grid grid-cols-1 gap-2">{(verTodos ? slots : slots.slice(0, 3)).map((s) => <span key={s.inicio} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{s.hora} – {s.finHora}</span>)}</div>
          {!slots.length && <p className="mt-2 text-xs text-slate-500">No hay intervalos disponibles para esta fecha.</p>}
          {slots.length > 3 && <button type="button" className="mt-3 text-xs font-semibold text-blue-600" aria-expanded={verTodos} onClick={() => setVerTodos(!verTodos)}>{verTodos ? 'Mostrar menos' : 'Ver todos los intervalos'}</button>}
        </div> : <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Administración debe publicar la jornada. Recepción puede proponer una cita y se verificará que no haya cruces.</p>}
        {resumen.descansos.filter((d) => d.fecha === fecha).map((d, i) => <p key={i} className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">Descanso asignado: {d.inicio} – {d.fin}{d.motivo ? ` · ${d.motivo}` : ''}</p>)}
        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">Actualizado: {horaClinica(resumen.actualizado)}. Se revisa cada minuto y al volver a esta ventana.</p>
      </>}
      </div>
    </section>
  )
}
