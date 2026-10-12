'use client'

import { useEffect, useState } from 'react'
import { Bed, ClipboardList, FlaskConical, Users } from 'lucide-react'
import { Stat } from '@/components/modulos/compartidos/ui'
import { cargarResumenCamas, cargarResumenEstadisticas } from '@/lib/supabase/datos'
import { leerCamas, leerEstadisticas } from '@/lib/supabase/cache-modulos'

export function EstadisticasEnfermero() {
  const [estadisticas, setEstadisticas] = useState(() => leerEstadisticas())
  const [camas, setCamas] = useState(() => leerCamas() ?? { ocupadas: 0, total: 0, libres: 0 })

  useEffect(() => {
    let vigente = true
    const cargar = () => {
      void Promise.all([cargarResumenEstadisticas(), cargarResumenCamas()]).then(
        ([resStats, resCamas]) => {
          if (!vigente) return
          if (!resStats.error) setEstadisticas(resStats.filas)
          if (!resCamas.error) setCamas(resCamas.filas)
        },
      )
    }
    cargar()
    window.addEventListener('datos-actualizados', cargar)
    return () => {
      vigente = false
      window.removeEventListener('datos-actualizados', cargar)
    }
  }, [])

  const ordenes = estadisticas?.['Órdenes pendientes']?.value ?? '0'
  const camasTexto = camas.total > 0 ? `${camas.ocupadas} / ${camas.total}` : '0'

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        icon={Bed}
        label="Camas ocupadas"
        value={camasTexto}
        meta={`${camas.libres} camas libres`}
        tone="blue"
      />
      <Stat
        icon={Users}
        label="Pacientes internados"
        value={String(camas.ocupadas)}
        meta="En hospitalización"
        tone="green"
      />
      <Stat
        icon={ClipboardList}
        label="Órdenes pendientes"
        value={ordenes}
        meta="Tratamientos y medicamentos"
        tone="orange"
      />
      <Stat
        icon={FlaskConical}
        label="Laboratorio clínico"
        value="Activo"
        meta="Toma de muestras"
        tone="blue"
      />
    </div>
  )
}
