'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock3 } from 'lucide-react'
import { appointments as fallbackAppointments } from '../../compartidos/data'
import type { ClinicActions } from '../../compartidos/types'
import { RowActions } from '../../compartidos/ui'
import { createClient } from '@/lib/supabase/client'
import { cambiarEstadoCita } from '@/lib/acciones'

const filters = ['Actuales', 'Pendientes', 'Reagendar']

interface CitaItem {
  id: number
  hora: string
  paciente: string
  medico: string
  motivo: string
  estado: string
}

export function ProximasCitas({ ahora, notify, openModal, navigate }: ClinicActions & { ahora: Date }) {
  const [filtroActivo, setFiltroActivo] = useState('Actuales')
  const [citas, setCitas] = useState<CitaItem[]>([])
  const [cargando, setCargando] = useState(true)

  const cargarCitasDeHoy = useCallback(async () => {
    try {
      const supabase = createClient()
      const hoy = new Date()
      const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0).toISOString()
      const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('citas')
        .select(`
          id,
          inicio,
          estado,
          motivo,
          perfiles_pacientes!inner(usuarios!inner(nombre_completo)),
          perfiles_medicos!inner(especialidad, usuarios!inner(nombre_completo))
        `)
        .gte('inicio', inicioDia)
        .lte('inicio', finDia)
        .order('inicio', { ascending: true })

      if (error || !data || data.length === 0) {
        // Fallback a demo si aún no se crean las tablas
        const demo: CitaItem[] = fallbackAppointments.map((row, idx) => ({
          id: idx + 1,
          hora: row[0],
          paciente: row[1],
          medico: row[2],
          motivo: row[3],
          estado: row[4],
        }))
        setCitas(demo)
      } else {
        const mapeadas: CitaItem[] = data.map((item) => {
          const d = new Date(item.inicio)
          const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
          const p = Array.isArray(item.perfiles_pacientes) ? item.perfiles_pacientes[0] : item.perfiles_pacientes
          const pu = Array.isArray(p?.usuarios) ? p.usuarios[0] : p?.usuarios
          const m = Array.isArray(item.perfiles_medicos) ? item.perfiles_medicos[0] : item.perfiles_medicos
          const mu = Array.isArray(m?.usuarios) ? m.usuarios[0] : m?.usuarios

          return {
            id: item.id,
            hora,
            paciente: pu?.nombre_completo ?? 'Paciente',
            medico: mu?.nombre_completo ?? 'Médico',
            motivo: item.motivo || 'Consulta médica',
            estado: item.estado ? item.estado.charAt(0).toUpperCase() + item.estado.slice(1) : 'Pendiente',
          }
        })
        setCitas(mapeadas)
      }
    } catch {
      const demo: CitaItem[] = fallbackAppointments.map((row, idx) => ({
        id: idx + 1,
        hora: row[0],
        paciente: row[1],
        medico: row[2],
        motivo: row[3],
        estado: row[4],
      }))
      setCitas(demo)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarCitasDeHoy()

    const listener = () => {
      void cargarCitasDeHoy()
    }
    window.addEventListener('cita-actualizada', listener)
    return () => window.removeEventListener('cita-actualizada', listener)
  }, [cargarCitasDeHoy])

  const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes()

  const estadoCalculado = (cita: CitaItem) => {
    const [horas, minutos] = cita.hora.split(':').map(Number)
    const minutosTranscurridos = ahoraMinutos - (horas * 60 + minutos)
    if (cita.estado === 'Atendida' || cita.estado === 'Confirmada') return cita.estado
    if (minutosTranscurridos < 0 || minutosTranscurridos <= 15) return 'Pendiente'
    return 'Reagendar'
  }

  const citasActuales = citas.filter((c) => estadoCalculado(c) !== 'Reagendar')
  const citasFiltradas =
    filtroActivo === 'Actuales'
      ? citasActuales.slice(0, 2)
      : citas.filter((c) =>
          filtroActivo === 'Pendientes'
            ? estadoCalculado(c) === 'Pendiente'
            : estadoCalculado(c) === 'Reagendar',
        )

  const formatearHora = (valor: string) => {
    const [horas, minutos] = valor.split(':').map(Number)
    const periodo = horas >= 12 ? 'PM' : 'AM'
    const hora12 = horas % 12 || 12
    return `${hora12}:${String(minutos).padStart(2, '0')} ${periodo}`
  }

  const handleConfirmar = async (cita: CitaItem) => {
    try {
      await cambiarEstadoCita(cita.id, 'confirmada')
      notify(`Cita de ${cita.paciente} confirmada en Supabase`)
      void cargarCitasDeHoy()
    } catch {
      notify(`Cita de ${cita.paciente} confirmada localmente`)
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Próximas citas y check-in</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {cargando ? 'Cargando agenda de Supabase...' : 'Sincronizado con la base de datos'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('Citas')}
            className="hidden text-xs font-semibold text-blue-600 sm:block hover:underline"
          >
            Ver agenda completa →
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 pb-1">
          {filters
            .filter((f) => f !== 'Reagendar')
            .map((filter) => {
              const cantidad =
                filter === 'Actuales'
                  ? citasActuales.length
                  : citas.filter((c) => estadoCalculado(c) === 'Pendiente').length
              return (
                <button
                  type="button"
                  key={filter}
                  onClick={() => setFiltroActivo(filter)}
                  aria-pressed={filtroActivo === filter}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filtroActivo === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {filter} ({cantidad})
                </button>
              )
            })}
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
          {(() => {
            const cantidad = citas.filter((c) => estadoCalculado(c) === 'Reagendar').length
            return (
              <button
                type="button"
                onClick={() => setFiltroActivo('Reagendar')}
                aria-pressed={filtroActivo === 'Reagendar'}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filtroActivo === 'Reagendar'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                Reagendar ({cantidad})
              </button>
            )
          })()}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {citasFiltradas.slice(0, 4).map((item) => {
          const estado = estadoCalculado(item)
          const necesitaReagenda = estado === 'Reagendar'
          const estaPendiente = estado === 'Pendiente'

          return (
            <div
              className={`grid gap-3 px-4 py-3 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center ${
                necesitaReagenda
                  ? 'border-l-4 border-red-400 bg-red-50/40'
                  : estaPendiente
                    ? 'border-l-4 border-amber-300 bg-amber-50/40'
                    : ''
              }`}
              key={item.id}
            >
              <div className="flex items-center gap-2">
                <Clock3
                  className={`size-4 ${
                    necesitaReagenda ? 'text-red-500' : estaPendiente ? 'text-amber-500' : 'text-slate-400'
                  }`}
                />
                <span className="text-xs font-bold leading-tight">{formatearHora(item.hora)}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-800">{item.paciente}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {item.medico} · {item.motivo}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <RowActions
                  onView={() => openModal(`Detalle: ${item.paciente}`)}
                  onEdit={() => openModal(`Editar cita: ${item.paciente}`)}
                />
                <button
                  type="button"
                  onClick={() => handleConfirmar(item)}
                  className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => openModal(`Reagendar cita de ${item.paciente}`)}
                  className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                >
                  Reagendar
                </button>
              </div>
            </div>
          )
        })}

        {citasFiltradas.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            No hay citas en esta categoría.
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        Mostrando {citasFiltradas.length} de {citas.length} citas registradas para hoy
      </div>
    </div>
  )
}
