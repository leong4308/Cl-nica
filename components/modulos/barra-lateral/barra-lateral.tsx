'use client'

import { useEffect, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { cargarInsigniasMenu } from '@/lib/supabase/datos'
import { guardarInsignias, leerInsignias } from '@/lib/supabase/cache-modulos'
import { obtenerNavItemsPorRol, itemsAdministracion } from './navegacion/items-menu'
import { BotonAdminLateral } from './admin-lateral/boton-admin-lateral'
import { BotonCerrarBarra } from './cerrar-barra/boton-cerrar-barra'
import { BotonNavLateral } from './nav-lateral/boton-nav-lateral'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

type BarraLateralProps = {
  activo: string
  abierto: boolean
  onNavegar: (label: string) => void
  onAbrirModal: (title: string) => void
  onCerrar: () => void
  rol: RolUsuario
}

export function BarraLateral({ activo, abierto, onNavegar, onAbrirModal, onCerrar, rol }: BarraLateralProps) {
  const [insignias, setInsignias] = useState<Record<string, string>>(() => leerInsignias())
  const esAdmin = rol === 'admin'
  const itemsNav = obtenerNavItemsPorRol(rol)

  useEffect(() => {
    let vigente = true
    const actualizar = () => {
      void cargarInsigniasMenu().then((datos) => {
        if (!vigente) return
        setInsignias(datos)
        guardarInsignias(datos)
      })
    }
    actualizar()
    window.addEventListener('datos-actualizados', actualizar)
    return () => {
      vigente = false
      window.removeEventListener('datos-actualizados', actualizar)
    }
  }, [])

  const etiquetaRol =
    rol === 'medico'
      ? 'Médico'
      : rol === 'admin'
      ? 'Administrador'
      : rol === 'recepcionista'
      ? 'Recepcionista'
      : rol === 'enfermero'
      ? 'Enfermero'
      : 'Sistema Médico'

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${abierto ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[82px] items-center gap-3 border-b border-slate-100 px-7">
        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200"><HeartPulse size={23} /></div>
        <div>
          <b className="text-[17px] tracking-tight text-slate-900">Clínica Nova</b>
          <p className="text-[10px] font-semibold tracking-wider text-blue-600 uppercase">{etiquetaRol}</p>
        </div>
        <BotonCerrarBarra onCerrar={onCerrar} />
      </div>

      <nav className="flex flex-col gap-1 px-4 pt-7">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Menú principal</p>
        {itemsNav.map((item) => (
          <BotonNavLateral
            key={item.label}
            etiqueta={item.label}
            Icono={item.icon}
            activo={activo === item.label}
            insignia={insignias[item.label]}
            onNavegar={onNavegar}
          />
        ))}
      </nav>

      {/* Sección de Administración — solo visible para admin */}
      {esAdmin && (
        <div className="mt-8 px-4">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Administración</p>
          <div className="flex flex-col gap-1">
            {itemsAdministracion.map(({ label, icono: Icono }) => (
              <BotonAdminLateral key={label} etiqueta={label} Icono={Icono} onAbrirModal={onAbrirModal} />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}