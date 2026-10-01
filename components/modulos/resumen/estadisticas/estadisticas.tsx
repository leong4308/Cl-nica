'use client'

import { useEffect, useState } from 'react'
import { dashboardStats } from '../../compartidos/data'
import { Stat } from '../../compartidos/ui'
import { createClient } from '@/lib/supabase/client'

export function Estadisticas() {
  const [estadisticas, setEstadisticas] = useState(dashboardStats)

  useEffect(() => {
    const cargarEstadisticas = async () => {
      const supabase = createClient()
      const inicioDelDia = new Date()
      inicioDelDia.setHours(0, 0, 0, 0)
      const finDelDia = new Date(inicioDelDia)
      finDelDia.setDate(inicioDelDia.getDate() + 1)
      const [citas, pacientes, camas, ordenes] = await Promise.all([
        supabase.from('citas').select('id', { count: 'exact', head: true }).gte('inicio', inicioDelDia.toISOString()).lt('inicio', finDelDia.toISOString()),
        supabase.from('perfiles_pacientes').select('id', { count: 'exact', head: true }).eq('esta_activo', true),
        supabase.from('camas').select('id', { count: 'exact', head: true }),
        supabase.from('ordenes_medicas').select('id', { count: 'exact', head: true }).in('estado', ['prescrita', 'en_proceso']),
      ])
      const totalCamas = camas.count ?? 0
      const valores: Record<string, { value: string; meta: string }> = {
        'Citas de hoy': { value: String(citas.count ?? 0), meta: 'Datos en tiempo real' },
        'Pacientes activos': { value: (pacientes.count ?? 0).toLocaleString('es-MX'), meta: 'Pacientes activos' },
        'Camas ocupadas': { value: String(totalCamas), meta: 'Ocupación actual' },
        'Órdenes pendientes': { value: String(ordenes.count ?? 0).padStart(2, '0'), meta: 'Requieren atención' },
      }
      setEstadisticas((actuales) => actuales.map((stat) => (valores[stat.label] ? { ...stat, ...valores[stat.label] } : stat)))
    }
    void cargarEstadisticas()
  }, [])

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {estadisticas.map((stat) => <Stat key={stat.label} {...stat} />)}
    </div>
  )
}
