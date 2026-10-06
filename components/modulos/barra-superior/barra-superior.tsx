'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Menu } from 'lucide-react'
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/supabase/tipos-rol'
import { opcionCerrarSesion, opcionesMenuUsuario, fechaEncabezado, saludoEncabezado } from './datos-encabezado'

const iniciales = (nombre: string) => nombre.split(' ').filter(Boolean).slice(0, 2).map((palabra) => palabra[0]?.toUpperCase() ?? '').join('') || 'US'

export function BarraSuperior({ onAbrirMenu, onAbrirModal, onCerrarSesion, usuario }: { onAbrirMenu: () => void; onAbrirModal: (title: string) => void; onCerrarSesion: () => void; usuario: { nombre: string; rol: RolUsuario } }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [ahora, setAhora] = useState(() => new Date())
  const contenedor = useRef<HTMLDivElement>(null)

  // La fecha y el saludo se refrescan igual que en el resumen, para no dejar
  // una fecha vieja clavada en la barra.
  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(new Date()), 60_000)
    return () => window.clearInterval(intervalo)
  }, [])

  useEffect(() => {
    if (!menuAbierto) return
    const cerrarFuera = (event: MouseEvent) => { if (contenedor.current && !contenedor.current.contains(event.target as Node)) setMenuAbierto(false) }
    const cerrarConEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuAbierto(false) }
    document.addEventListener('mousedown', cerrarFuera)
    document.addEventListener('keydown', cerrarConEscape)
    return () => {
      document.removeEventListener('mousedown', cerrarFuera)
      document.removeEventListener('keydown', cerrarConEscape)
    }
  }, [menuAbierto])

  const elegirOpcion = (titulo: string) => {
    setMenuAbierto(false)
    onAbrirModal(titulo)
  }

  return (
    <header className="flex h-[82px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-9">
      <div className="flex items-center gap-4">
        <button type="button" className="lg:hidden" onClick={onAbrirMenu} aria-label="Abrir menú"><Menu size={21} /></button>
        <div>
          <p className="text-[11px] text-slate-400">{fechaEncabezado(ahora)}</p>
          <h1 className="text-[21px] font-bold tracking-tight">{saludoEncabezado(ahora)}, {usuario.nombre.split(' ')[0]}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => onAbrirModal('Notificaciones')} aria-label="Notificaciones" className="relative text-slate-500">
          <Bell size={20} />
          <i className="absolute -right-1 -top-1 size-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>
        <div className="hidden h-7 w-px bg-slate-200 sm:block" />

        <div className="relative" ref={contenedor}>
          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
            aria-label="Menú de usuario"
            className="flex items-center gap-2"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{iniciales(usuario.nombre)}</span>
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${menuAbierto ? 'rotate-180' : ''}`} />
          </button>

          {menuAbierto && (
            <div role="menu" className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <b className="block truncate text-[13px] text-slate-800">{usuario.nombre}</b>
                <span className="text-[11px] text-slate-400">{ETIQUETA_ROL[usuario.rol]}</span>
              </div>

              {opcionesMenuUsuario.map(({ etiqueta, icono: Icono, modal }) => (
                <button key={etiqueta} type="button" role="menuitem" onClick={() => elegirOpcion(modal)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                  <Icono size={16} className="shrink-0 text-slate-400" />
                  {etiqueta}
                </button>
              ))}

              <div className="my-1 border-t border-slate-100" />

              <button type="button" role="menuitem" onClick={onCerrarSesion} className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50">
                <opcionCerrarSesion.icono size={16} className="shrink-0" />
                {opcionCerrarSesion.etiqueta}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
