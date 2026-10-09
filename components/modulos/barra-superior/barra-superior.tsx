'use client'

import { useEffect, useRef, useState } from 'react'
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/supabase/tipos-rol'
import { opcionCerrarSesion, opcionesMenuUsuario, fechaEncabezado, saludoEncabezado } from './datos-encabezado'
import { BotonNotificaciones } from './notificaciones'
import { BotonAbrirMenu } from './abrir-menu'
import { BotonAvatarMenu, BotonOpcionMenu, BotonCerrarSesion } from './menu-usuario'

export function BarraSuperior({ onAbrirMenu, onAbrirModal, onCerrarSesion, usuario }: { onAbrirMenu: () => void; onAbrirModal: (title: string) => void; onCerrarSesion: () => void; usuario: { nombre: string; rol: RolUsuario } }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [ahora, setAhora] = useState(() => new Date())
  const contenedor = useRef<HTMLDivElement>(null)

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
        <BotonAbrirMenu onAbrir={onAbrirMenu} />
        <div>
          <p className="text-[11px] text-slate-400">{fechaEncabezado(ahora)}</p>
          <h1 className="text-[21px] font-bold tracking-tight">{saludoEncabezado(ahora)}, {usuario.nombre.split(' ')[0]}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <BotonNotificaciones onAbrir={() => onAbrirModal('Notificaciones')} />
        <div className="hidden h-7 w-px bg-slate-200 sm:block" />

        <div className="relative" ref={contenedor}>
          <BotonAvatarMenu nombre={usuario.nombre} abierto={menuAbierto} onAlternar={() => setMenuAbierto((abierto) => !abierto)} />

          {menuAbierto && (
            <div role="menu" className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <b className="block truncate text-[13px] text-slate-800">{usuario.nombre}</b>
                <span className="text-[11px] text-slate-400">{ETIQUETA_ROL[usuario.rol]}</span>
              </div>

              {opcionesMenuUsuario.map(({ etiqueta, icono: Icono, modal }) => (
                <BotonOpcionMenu key={etiqueta} etiqueta={etiqueta} Icono={Icono} modal={modal} onElegir={elegirOpcion} />
              ))}

              <div className="my-1 border-t border-slate-100" />

              <BotonCerrarSesion etiqueta={opcionCerrarSesion.etiqueta} Icono={opcionCerrarSesion.icono} onSalir={onCerrarSesion} />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
