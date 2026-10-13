'use client'

import { useEffect, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { cargarInsigniasMenu } from '@/lib/supabase/datos'
import { guardarInsignias, leerInsignias } from '@/lib/supabase/cache-modulos'
import { BotonCerrarBarra } from '@/components/modulos/barra-lateral/cerrar-barra/boton-cerrar-barra'
import { BotonNavLateral } from '@/components/modulos/barra-lateral/nav-lateral/boton-nav-lateral'
import { navItemsEnfermero } from './navegacion/items-menu'

type BarraLateralEnfermeroProps = {
  activo: string
  abierto: boolean
  onNavegar: (label: string) => void
  onCerrar: () => void
}

export function BarraLateralEnfermero({
  activo,
  abierto,
  onNavegar,
  onCerrar,
}: BarraLateralEnfermeroProps) {
  const [insignias, setInsignias] = useState<Record<string, string>>(() => leerInsignias())

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

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
        abierto ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-[82px] items-center gap-3 border-b border-slate-100 px-7">
        <div className="flex size-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-200">
          <HeartPulse size={23} />
        </div>
        <div>
          <b className="text-[17px] tracking-tight text-slate-900">Clínica Nova</b>
          <p className="text-[10px] font-semibold tracking-wider text-teal-600 uppercase">Enfermero</p>
        </div>
        <BotonCerrarBarra onCerrar={onCerrar} />
      </div>

      <nav className="flex flex-col gap-1 px-4 pt-7">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">
          Menú de Enfermería
        </p>
        {navItemsEnfermero.map(([label, Icon]) => (
          <BotonNavLateral
            key={label}
            etiqueta={label}
            Icono={Icon}
            activo={activo === label}
            insignia={insignias[label]}
            onNavegar={onNavegar}
          />
        ))}
      </nav>
    </aside>
  )
}
