'use client'

import { HeartPulse } from 'lucide-react'
import { insigniasMenu, itemsAdministracion, navItems } from './navegacion/items-menu'
import { BotonAdminLateral } from './admin-lateral/boton-admin-lateral'
import { BotonCerrarBarra } from './cerrar-barra/boton-cerrar-barra'
import { BotonNavLateral } from './nav-lateral/boton-nav-lateral'

type BarraLateralProps = {
  activo: string
  abierto: boolean
  onNavegar: (label: string) => void
  onAbrirModal: (title: string) => void
  onCerrar: () => void
}

export function BarraLateral({ activo, abierto, onNavegar, onAbrirModal, onCerrar, esAdmin }: BarraLateralProps & { esAdmin?: boolean }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${abierto ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[82px] items-center gap-3 border-b border-slate-100 px-7">
        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white"><HeartPulse size={23} /></div>
        <div><b className="text-[17px] tracking-tight">Clínica Nova</b><p className="text-[10px] font-medium tracking-widest text-slate-400">SISTEMA MÉDICO</p></div>
        <BotonCerrarBarra onCerrar={onCerrar} />
      </div>

      <nav className="flex flex-col gap-1 px-4 pt-7">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Menú principal</p>
        {navItems.map(([label, Icon]) => <BotonNavLateral key={label} etiqueta={label} Icono={Icon} activo={activo === label} insignia={insigniasMenu[label]} onNavegar={onNavegar} />)}
      </nav>

      <div className="mt-8 px-4">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Administración</p>
        <div className="flex flex-col gap-1">
          {itemsAdministracion.filter((item) => !item.soloAdmin || esAdmin).map(({ label, icono: Icono }) => <BotonAdminLateral key={label} etiqueta={label} Icono={Icono} onAbrirModal={onAbrirModal} />)}
        </div>
      </div>
    </aside>
  )
}