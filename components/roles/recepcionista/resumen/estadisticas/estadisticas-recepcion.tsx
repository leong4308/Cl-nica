'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Clock, Stethoscope, UsersRound } from 'lucide-react'
import { Stat } from '@/components/modulos/compartidos/ui'
import { cargarResumenEstadisticas } from '@/lib/supabase/datos'
import { leerEstadisticas } from '@/lib/supabase/cache-modulos'

export function EstadisticasRecepcion() {
  const [estadisticas, setEstadisticas] = useState(() => leerEstadisticas())

  useEffect(() => {
    let vigente = true
    const cargar = () => {
      void cargarResumenEstadisticas().then((resultado) => {
        if (!vigente || resultado.error) return
        setEstadisticas(resultado.filas)
      })
    }
    cargar()
    window.addEventListener('datos-actualizados', cargar)
    return () => {
      vigente = false
      window.removeEventListener('datos-actualizados', cargar)
    }
  }, [])

  const citasHoy = estadisticas?.['Citas de hoy']?.value ?? '0'
  const pacientes = estadisticas?.['Pacientes activos']?.value ?? '0'
  const ordenes = estadisticas?.['Órdenes pendientes']?.value ?? '0'

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        icon={CalendarDays}
        label="Citas de hoy"
        value={citasHoy}
        meta="Consultas programadas"
        tone="blue"
      />
      <Stat
        icon={UsersRound}
        label="Pacientes activos"
        value={pacientes}
        meta="En base de datos"
        tone="green"
      />
      <Stat
        icon={Clock}
        label="Citas por atender"
        value={citasHoy}
        meta="Pacientes citados"
        tone="orange"
      />
      <Stat
        icon={Stethoscope}
        label="Médicos en turno"
        value="Activos"
        meta="Horarios disponibles"
        tone="blue"
      />
    </div>
  )
}
