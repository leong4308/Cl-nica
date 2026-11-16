'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCheck, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import { ModalMarco } from '@/components/modulos/compartidos/modal-marco'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, AvisoClinico } from '@/components/modulos/compartidos/editor-clinico'
import { usarNotificaciones } from '../usar-notificaciones'
import { PreferenciasCorreo } from '../preferencias-correo'
import { VincularTelegram } from '../vincular-telegram'

export function BotonNotificaciones({ usuarioId, onVerCita }: { usuarioId?: number; onVerCita?: (id: number) => void }) {
  const [abierto, setAbierto] = useState(false)
  const n = usarNotificaciones(usuarioId)
  useEffect(() => { if (abierto) void n.refrescar() }, [abierto, n.refrescar])
  return <>
    <button type="button" onClick={() => setAbierto(true)} aria-label="Notificaciones" aria-description={`${n.sinLeer} sin leer`} className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
      <Bell size={20} />
      {n.sinLeer > 0 && <span aria-hidden="true" className="absolute -right-2 -top-1 flex min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">{n.sinLeer > 99 ? '99+' : n.sinLeer}</span>}
    </button>
    {abierto && <ModalMarco title="Notificaciones" ancho="max-w-3xl" contenidoFijo onClose={() => setAbierto(false)} footer={<div className="flex flex-wrap justify-between gap-3"><button type="button" className={BOTON_SECUNDARIO} onClick={() => { void n.alternarSonido() }}>{n.sonido ? <Volume2 size={16} /> : <VolumeX size={16} />}{n.sonido ? 'Silenciar avisos' : 'Activar sonido'}</button><button type="button" className={BOTON_PRIMARIO} onClick={() => setAbierto(false)}>Cerrar</button></div>}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-slate-500">{n.sinLeer} sin leer · Últimos 50 avisos</p><div className="flex gap-2"><button type="button" className={BOTON_SECUNDARIO} onClick={() => { void n.refrescar() }} aria-label="Actualizar notificaciones"><RefreshCw size={15} /></button><button type="button" className={BOTON_SECUNDARIO} disabled={!n.sinLeer} onClick={() => { void n.marcar() }}><CheckCheck size={15} />Marcar todas como leídas</button></div></div>
      <AvisoClinico mensaje={n.error} />
      {!n.avisos.length && !n.error && <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center"><Bell className="mx-auto text-slate-400" size={24} /><p className="mt-3 text-sm text-slate-600">Tus avisos aparecerán aquí cuando haya novedades.</p><p className="mt-2 text-xs text-slate-500">Recibirás cambios de citas y recordatorios de las próximas 24 y 2 horas.</p></div>}
      <div className="space-y-3">{n.avisos.map(aviso => <article key={aviso.id} className={`rounded-xl border p-4 ${aviso.leida_en ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/60'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-sm font-semibold text-slate-900">{!aviso.leida_en && <span className="mr-2 inline-block size-2 rounded-full bg-blue-600" />}{aviso.titulo}</h4><time className="text-xs text-slate-500" dateTime={aviso.creado_en}>{new Date(aviso.creado_en).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' })}</time></div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{aviso.mensaje}</p>
        <div className="mt-3 flex flex-wrap gap-3">{!aviso.leida_en && <button type="button" className="text-xs font-medium text-blue-700" onClick={() => { void n.marcar(aviso.id) }}>Marcar como leída</button>}{aviso.cita_id && onVerCita && <button type="button" className="text-xs font-medium text-blue-700" onClick={() => { void n.marcar(aviso.id); setAbierto(false); onVerCita(aviso.cita_id!) }}>Ver cita</button>}</div>
      </article>)}</div>
      <PreferenciasCorreo />
      <VincularTelegram />
    </ModalMarco>}
  </>
}
