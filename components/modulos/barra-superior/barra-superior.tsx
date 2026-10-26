'use client'

import { useEffect, useRef, useState } from 'react'
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/supabase/tipos-rol'
import type { PerfilSesion } from '@/lib/supabase/sesion'
import { opcionCerrarSesion, opcionesMenuUsuario, fechaEncabezado, saludoEncabezado } from './datos-encabezado'
import { BotonNotificaciones } from './notificaciones'
import { BotonAbrirMenu } from './abrir-menu'
import { BotonAvatarMenu, BotonOpcionMenu, BotonCerrarSesion } from './menu-usuario'

type BarraSuperiorProps = {
  onAbrirMenu: () => void
  onAbrirModal: (title: string) => void
  onCerrarSesion: () => void
  usuario: PerfilSesion
  onCambiarRol?: (nuevoRol: RolUsuario, medicoId?: number, nombre?: string) => void
  onCambiarVistaRol?: (nuevoRol: RolUsuario) => void
}

export function BarraSuperior({
  onAbrirMenu,
  onAbrirModal,
  onCerrarSesion,
  usuario,
}: BarraSuperiorProps) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [ahora, setAhora] = useState(() => new Date())
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(new Date()), 60_000)
    return () => window.clearInterval(intervalo)
  }, [])

  useEffect(() => {
    if (!menuAbierto) return
    const cerrarFuera = (event: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(event.target as Node)) {
        setMenuAbierto(false)
      }
    }
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuAbierto(false)
      }
    }
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
      {/* Lado izquierdo: Menú móvil y saludo */}
      <div className="flex items-center gap-4">
        <BotonAbrirMenu onAbrir={onAbrirMenu} />
        <div>
          <p className="text-[11px] text-slate-400">{fechaEncabezado(ahora)}</p>
          <h1 className="text-[21px] font-bold tracking-tight">
            {saludoEncabezado(ahora)}, {usuario.nombre.split(' ')[0]}
          </h1>
        </div>
      </div>

      {/* Centro / Derecha: Rol y Acciones */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
          <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline text-slate-400 font-medium">Rol:</span>
          <span className="text-slate-900 font-bold">{ETIQUETA_ROL[usuario.rol]}</span>
          {usuario.rol === 'medico' && (
            <span className="text-blue-600 font-medium">({usuario.nombre.split(' ')[0]})</span>
          )}
        </div>


        <BotonNotificaciones onAbrir={() => onAbrirModal('Notificaciones')} />
        <div className="hidden h-7 w-px bg-slate-200 sm:block" />

        {/* Menú de Usuario */}
        <div className="relative" ref={contenedor}>
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-100">
              {ETIQUETA_ROL[usuario.rol]}
            </span>
            <BotonAvatarMenu
              nombre={usuario.nombre}
              abierto={menuAbierto}
              onAlternar={() => setMenuAbierto((abierto) => !abierto)}
            />
          </div>

          {menuAbierto && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              <div className="border-b border-slate-100 px-4 py-2.5">
                <b className="block truncate text-[13px] text-slate-800">{usuario.nombre}</b>
                <span className="text-[11px] font-semibold text-blue-600">{ETIQUETA_ROL[usuario.rol]}</span>
              </div>

              {opcionesMenuUsuario.map(({ etiqueta, icono: Icono, modal }) => (
                <BotonOpcionMenu
                  key={etiqueta}
                  etiqueta={etiqueta}
                  Icono={Icono}
                  modal={modal}
                  onElegir={elegirOpcion}
                />
              ))}



              <div className="my-1 border-t border-slate-100" />

              <BotonCerrarSesion
                etiqueta={opcionCerrarSesion.etiqueta}
                Icono={opcionCerrarSesion.icono}
                onSalir={onCerrarSesion}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
