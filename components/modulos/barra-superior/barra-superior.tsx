'use client'

import { useEffect, useRef, useState } from 'react'
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/supabase/tipos-rol'
import type { PerfilSesion } from '@/lib/supabase/sesion'
import { opcionCerrarSesion, opcionesMenuUsuario, fechaEncabezado, saludoEncabezado } from './datos-encabezado'
import { BotonNotificaciones } from './notificaciones'
import { BotonAbrirMenu } from './abrir-menu'
import { BotonAvatarMenu, BotonOpcionMenu, BotonCerrarSesion } from './menu-usuario'
import { Shield, UserCheck, Stethoscope, ChevronDown, Check } from 'lucide-react'

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
  onCambiarRol,
  onCambiarVistaRol,
}: BarraSuperiorProps) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [rolesAbierto, setRolesAbierto] = useState(false)
  const [ahora, setAhora] = useState(() => new Date())
  const contenedor = useRef<HTMLDivElement>(null)
  const rolesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(new Date()), 60_000)
    return () => window.clearInterval(intervalo)
  }, [])

  useEffect(() => {
    if (!menuAbierto && !rolesAbierto) return
    const cerrarFuera = (event: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(event.target as Node)) {
        setMenuAbierto(false)
      }
      if (rolesRef.current && !rolesRef.current.contains(event.target as Node)) {
        setRolesAbierto(false)
      }
    }
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuAbierto(false)
        setRolesAbierto(false)
      }
    }
    document.addEventListener('mousedown', cerrarFuera)
    document.addEventListener('keydown', cerrarConEscape)
    return () => {
      document.removeEventListener('mousedown', cerrarFuera)
      document.removeEventListener('keydown', cerrarConEscape)
    }
  }, [menuAbierto, rolesAbierto])

  const elegirOpcion = (titulo: string) => {
    setMenuAbierto(false)
    onAbrirModal(titulo)
  }

  // Opciones de vista de rol para pruebas y demostración de flujo completo
  const opcionesRol = [
    { rol: 'admin' as RolUsuario, etiqueta: 'Administrador General', subtitulo: 'Control global, staff y métricas', icono: Shield },
    { rol: 'recepcionista' as RolUsuario, etiqueta: 'Recepcionista', subtitulo: 'Agendar y derivar pacientes', icono: UserCheck },
    { rol: 'medico' as RolUsuario, medicoId: 1, nombre: 'Dra. Ana López', etiqueta: 'Médico: Dra. Ana López', subtitulo: 'Medicina General (Cédula CED-100234)', icono: Stethoscope },
    { rol: 'medico' as RolUsuario, medicoId: 2, nombre: 'Dr. Jorge Méndez', etiqueta: 'Médico: Dr. Jorge Méndez', subtitulo: 'Cardiología (Cédula CED-200567)', icono: Stethoscope },
    { rol: 'medico' as RolUsuario, medicoId: 3, nombre: 'Dra. Laura Ruiz', etiqueta: 'Médico: Dra. Laura Ruiz', subtitulo: 'Medicina Interna (Cédula CED-300891)', icono: Stethoscope },
  ]

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

      {/* Centro / Derecha: Selector de Rol y Acciones */}
      <div className="flex items-center gap-3.5">
        
        {/* Switcher de Roles (para verificar el flujo entre Recepción, Médicos y Admin) */}
        {onCambiarRol && (
          <div className="relative" ref={rolesRef}>
            <button
              type="button"
              onClick={() => setRolesAbierto(!rolesAbierto)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 transition"
              title="Cambiar perspectiva de rol"
            >
              <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline text-slate-400 font-medium">Vista:</span>
              <span className="text-slate-900 font-bold">{ETIQUETA_ROL[usuario.rol]}</span>
              {usuario.rol === 'medico' && (
                <span className="text-blue-600 font-medium">({usuario.nombre.split(' ')[0]})</span>
              )}
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {rolesAbierto && (
              <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Cambiar perspectiva de rol
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Verifica cómo fluye la información entre cada usuario
                  </p>
                </div>

                <div className="mt-1 space-y-1">
                  {opcionesRol.map((item) => {
                    const Icono = item.icono
                    const esActivo =
                      usuario.rol === item.rol &&
                      (item.rol !== 'medico' || usuario.medicoId === item.medicoId)

                    return (
                      <button
                        key={`${item.rol}-${item.medicoId ?? 0}`}
                        type="button"
                        onClick={() => {
                          onCambiarRol(item.rol, item.medicoId, item.nombre)
                          setRolesAbierto(false)
                        }}
                        className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                          esActivo ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${esActivo ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Icono size={13} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="truncate font-medium">{item.etiqueta}</span>
                            {esActivo && <Check size={13} className="text-blue-600 shrink-0 ml-1" />}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{item.subtitulo}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

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

              {onCambiarVistaRol && (
                <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/70">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Vista previa de rol
                  </p>
                  <div className="flex flex-col gap-1">
                    {(['admin', 'medico', 'recepcionista', 'enfermero'] as RolUsuario[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setMenuAbierto(false)
                          onCambiarVistaRol(r)
                        }}
                        className={`text-left text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                          usuario.rol === r
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        {ETIQUETA_ROL[r]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
