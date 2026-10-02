'use client'

import { HeartPulse, X } from 'lucide-react'
import { insigniasMenu, itemsAdministracion, navItems } from './items-menu'

type BarraLateralProps = {
  activo: string
  abierto: boolean
  onNavegar: (label: string) => void
  onAbrirModal: (title: string) => void
  onCerrar: () => void
}

export function BarraLateral({ activo, abierto, onNavegar, onAbrirModal, onCerrar }: BarraLateralProps) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${abierto ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[82px] items-center gap-3 border-b border-slate-100 px-7">
        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white"><HeartPulse size={23} /></div>
        <div><b className="text-[17px] tracking-tight">Clínica Nova</b><p className="text-[10px] font-medium tracking-widest text-slate-400">SISTEMA MÉDICO</p></div>
        <button type="button" className="ml-auto lg:hidden" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
      </div>

      <nav className="flex flex-col gap-1 px-4 pt-7">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Menú principal</p>
        {navItems.map(([label, Icon]) => <button type="button" key={label} onClick={() => onNavegar(label)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium ${activo === label ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}><Icon size={18} strokeWidth={1.8} /><span className="flex-1">{label}</span>{insigniasMenu[label] && <small className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px]">{insigniasMenu[label]}</small>}</button>)}
      </nav>

      <div className="mt-8 px-4">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Administración</p>
        <div className="flex flex-col gap-1">
          {itemsAdministracion.map(({ label, icono: Icono }) => <button type="button" key={label} onClick={() => onAbrirModal(label)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-slate-500 hover:bg-slate-50"><Icono size={18} />{label}</button>)}
        </div>
      </div>
    </aside>
  )
}