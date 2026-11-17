import { Bed, ClipboardList, FlaskConical, Users } from 'lucide-react'
import type { PanelEnfermeriaDatos } from '@/lib/enfermeria/modelo'
export function EstadisticasEnfermero({datos}:{datos:PanelEnfermeriaDatos}) {
 const camas=datos.resumenCamas
 const valores=[
  {icon:Bed,titulo:'Camas ocupadas',numero:camas?`${camas.ocupadas} / ${camas.total}`:'—',ayuda:camas?`${camas.libres} camas disponibles en tu clínica`:'No se pudo consultar la ocupación'},
  {icon:Users,titulo:'Pacientes asignados',numero:String(datos.pacientes.length),ayuda:`${datos.ingresos.length} en hospitalización durante tu turno`},
  {icon:ClipboardList,titulo:'Indicaciones pendientes',numero:String(datos.tareas.filter(t=>t.estado==='pendiente').length),ayuda:'Dosis, controles y cuidados de tus pacientes'},
  {icon:FlaskConical,titulo:'Muestras pendientes',numero:String(datos.muestras.filter(m=>m.estado_analisis!=='completado'&&!m.fecha_entrega_muestra).length),ayuda:'Toma y entrega de muestras asignadas'}
 ]
 return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{valores.map(v=><article key={v.titulo} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-sm text-slate-600">{v.titulo}</h3><v.icon size={20} className="text-teal-600" /></div><p className="mt-4 text-3xl font-semibold">{v.numero}</p><p className="mt-2 text-xs text-slate-500">{v.ayuda}</p></article>)}</div>
}
