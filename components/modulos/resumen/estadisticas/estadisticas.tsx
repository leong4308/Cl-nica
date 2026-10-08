'use client'

import { useEffect, useState } from 'react'
import { dashboardStats } from './stats-iniciales'
import { Stat } from '../../compartidos/ui'
import { cargarResumenEstadisticas } from '@/lib/supabase/datos'
import { leerEstadisticas } from '@/lib/supabase/cache-modulos'

export function Estadisticas() {
  // Los conteos llegan precargados: los indicadores muestran su valor real en el
  // primer render, en vez de "Cargando".
  const [estadisticas, setEstadisticas] = useState(() => {
    const valores = leerEstadisticas()
    return valores
      ? dashboardStats.map((stat) => (valores[stat.label] ? { ...stat, ...valores[stat.label] } : stat))
      : dashboardStats
  })

  useEffect(() => {
    let vigente = true
    const cargar = () => {
      void cargarResumenEstadisticas().then((resultado) => {
        if (!vigente || resultado.error) return
        setEstadisticas((actuales) => actuales.map((stat) => (resultado.filas[stat.label] ? { ...stat, ...resultado.filas[stat.label] } : stat)))
      })
    }
    cargar()
    window.addEventListener('datos-actualizados', cargar)
    return () => { vigente = false; window.removeEventListener('datos-actualizados', cargar) }
  }, [])

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {estadisticas.map((stat) => <Stat key={stat.label} {...stat} />)}
    </div>
  )
}
