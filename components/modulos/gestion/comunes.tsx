'use client'
import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { BOTON_SECUNDARIO } from '../compartidos/editor-clinico'
export const caja = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'
export const fechaHora = (v: string) => new Date(v).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' })
export const diaLegible = (v: string) => new Date(v + 'T12:00:00Z').toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', year: 'numeric' })
export const hora = (v: string) => new Date(v).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function CabeceraGestion({ titulo, detalle, cargando, actualizar, children }: { titulo: string; detalle: string; cargando: boolean; actualizar: () => void; children?: ReactNode }) {
  return <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Clínica Nova</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{titulo}</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{detalle}</p></div><div className="flex flex-wrap gap-2"><button disabled={cargando} className={BOTON_SECUNDARIO} onClick={actualizar}><RefreshCw size={16} />Actualizar</button>{children}</div></header>
}
export function AvisosGestion({ error, mensaje }: { error: string; mensaje: string }) { return <>{error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm leading-relaxed text-rose-800">{error}</p>}{mensaje && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">{mensaje}</p>}</> }
export function EstadoGestion({ estado }: { estado: string }) { const nombres: Record<string, string> = { enviado: 'Aceptado por el servicio', enviando: 'En proceso', pendiente: 'Pendiente', omitido: 'Omitido', fallido: 'Fallido', cita_agendada: 'Cita agendada', activa: 'Activa', resuelta: 'Resuelta', retirada: 'Retirada', completado: 'Completado', cancelado: 'Cancelado', aceptada: 'Aceptada', rechazada: 'Rechazada', vencida: 'Vencida', revocada: 'Revocada' }; return <span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-medium ' + (/fallido|cancelado|vencida/.test(estado) ? 'bg-rose-50 text-rose-800' : /enviado|completado|aceptada|resuelta/.test(estado) ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800')}>{nombres[estado] ?? estado}</span> }
