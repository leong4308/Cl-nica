'use client'

import { Bell, ChevronDown, Menu } from 'lucide-react'
import { fechaEncabezado, saludoEncabezado, usuarioEncabezado } from './datos-encabezado'

export function BarraSuperior({ onAbrirMenu, onAbrirModal }: { onAbrirMenu: () => void; onAbrirModal: (title: string) => void }) {
  return (
    <header className="flex h-[82px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-9">
      <div className="flex items-center gap-4">
        <button type="button" className="lg:hidden" onClick={onAbrirMenu} aria-label="Abrir menú"><Menu size={21} /></button>
        <div>
          <p className="text-[11px] text-slate-400">{fechaEncabezado}</p>
          <h1 className="text-[21px] font-bold tracking-tight">{saludoEncabezado}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => onAbrirModal('Notificaciones')} aria-label="Notificaciones" className="relative text-slate-500">
          <Bell size={20} />
          <i className="absolute -right-1 -top-1 size-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>
        <div className="hidden h-7 w-px bg-slate-200 sm:block" />
        <button type="button" onClick={() => onAbrirModal('Perfil')} className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{usuarioEncabezado.iniciales}</span>
          <ChevronDown size={15} className="text-slate-400" />
        </button>
      </div>
    </header>
  )
}
