'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock3, Loader2 } from 'lucide-react'
import type { ClinicActions } from '../../compartidos/types'
import { RowActions } from '../../compartidos/ui'
import { cargarCitasPanel, type CitaPanel } from '@/lib/supabase/datos'

/** Minutos de cortesía para el check-in antes de pasar la cita a "Reagendar". */
const MINUTOS_CORTESIA = 10

/** Estados finales: si la base ya los tiene, mandan sobre el cálculo del reloj. */
const ESTADOS_FINALES = new Set([
  'Atendida',
  'No asistió',
  'Cancelada por paciente',
  'Cancelada por médico',
])

type EstadoPanel = 'Confirmada' | 'Pendiente' | 'Reagendar'

/**
 * Estado operativo de una cita según la hora actual:
 *  - Todavía no llega         -> Confirmada
 *  - Llegó y van <= 10 min    -> Pendiente (esperando check-in)
 *  - Pasaron más de 10 min    -> Reagendar (el paciente no se presentó)
 *
 * Compara la marca de tiempo completa, no solo la hora, para que una cita de
 * ayer no se reporte como "Confirmada" solo porque su hora aún no pasó hoy.
 */
function estadoDe(cita: CitaPanel, ahoraMs: number): EstadoPanel {
  if (ESTADOS_FINALES.has(cita.estado)) return 'Confirmada'
  const transcurridos = (ahoraMs - cita.inicio) / 60_000
  if (transcurridos < 0) return 'Confirmada'
  if (transcurridos <= MINUTOS_CORTESIA) return 'Pendiente'
  return 'Reagendar'
}

/** Filtros de la interfaz. `estado` es el valor real que devuelve `estadoDe`,
 *  por eso se declara aparte del texto visible ("Pendientes" vs "Pendiente"). */
const FILTROS = [
  { etiqueta: 'Actuales', estado: 'Confirmada' },
  { etiqueta: 'Pendientes', estado: 'Pendiente' },
  { etiqueta: 'Reagendar', estado: 'Reagendar' },
] as const satisfies ReadonlyArray<{ etiqueta: string; estado: EstadoPanel }>

type Filtro = (typeof FILTROS)[number]['etiqueta']

export function ProximasCitas({ ahora, notify, openModal, navigate }: ClinicActions & { ahora: Date }) {
  const [filtroActivo, setFiltroActivo] = useState<Filtro>('Actuales')
  const [citas, setCitas] = useState<CitaPanel[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ahoraMs = ahora.getTime()

  useEffect(() => {
    let vigente = true
    const leer = () => {
      cargarCitasPanel().then((resultado) => {
        if (!vigente) return
        setCitas(resultado.filas)
        setError(resultado.error)
        setCargando(false)
      })
    }
    leer()
    // Al guardar una cita se relee desde Supabase en vez de agregar la fila a mano.
    window.addEventListener('datos-actualizados', leer)
    return () => { vigente = false; window.removeEventListener('datos-actualizados', leer) }
  }, [])

  const clasificadas = citas.map((cita) => ({ cita, estado: estadoDe(cita, ahoraMs) }))
  const cuenta = (estado: EstadoPanel) => clasificadas.filter((item) => item.estado === estado).length

  const filtro = FILTROS.find((item) => item.etiqueta === filtroActivo) ?? FILTROS[0]

  const citasFiltradas = filtro.etiqueta === 'Actuales'
    ? clasificadas.filter((item) => item.estado === filtro.estado).slice(0, 1)
    : clasificadas.filter((item) => item.estado === filtro.estado)

  /** "09:00" -> "9:00 AM" */
  const formatearHora = (valor: string) => {
    const [horas, minutos] = valor.split(':').map(Number)
    if (Number.isNaN(horas) || Number.isNaN(minutos)) return valor
    return `${horas % 12 || 12}:${String(minutos).padStart(2, '0')} ${horas >= 12 ? 'PM' : 'AM'}`
  }
return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Próximas citas y check-in</h3>
            <p className="mt-0.5 text-xs text-slate-400">Confirmación presencial y control de turno</p>
          </div>
          <button type="button" onClick={() => navigate('Citas')} className="hidden text-xs font-semibold text-blue-600 sm:block">
            Ver agenda completa →
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 pb-1">
          {FILTROS.filter((item) => item.etiqueta !== 'Reagendar').map((item) => (
            <button
              type="button"
              key={item.etiqueta}
              onClick={() => setFiltroActivo(item.etiqueta)}
              aria-pressed={filtroActivo === item.etiqueta}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                filtroActivo === item.etiqueta
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {item.etiqueta} ({cuenta(item.estado)})
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setFiltroActivo('Reagendar')}
            aria-pressed={filtroActivo === 'Reagendar'}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              filtroActivo === 'Reagendar' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            Reagendar ({cuenta('Reagendar')})
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {citasFiltradas.slice(0, 4).map(({ cita, estado }, index) => {
          const necesitaReagenda = estado === 'Reagendar'
          const estaPendiente = estado === 'Pendiente'
          return (
            <div
              key={`${cita.inicio}-${index}`}
              className={`grid gap-3 px-4 py-3 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center ${
                necesitaReagenda
                  ? 'border-l-4 border-red-400 bg-red-50/40'
                  : estaPendiente
                    ? 'border-l-4 border-amber-300 bg-amber-50/40'
                    : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock3 className={`size-4 ${necesitaReagenda ? 'text-red-500' : estaPendiente ? 'text-amber-500' : 'text-slate-400'}`} />
                <span className="text-xs font-bold leading-tight">{formatearHora(cita.hora)}</span>
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-800">{cita.paciente}</p>
                <p className="truncate text-[11px] text-slate-500">{cita.medico} · {cita.motivo}</p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {estaPendiente && (
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">
                    Esperando check-in
                  </span>
                )}
                <RowActions
                  onView={() => openModal(`Detalle de ${cita.paciente}`)}
                  onEdit={() => openModal(`Editar cita de ${cita.paciente}`)}
                />
                {estado === 'Confirmada' && (
                  <>
                    <button type="button" onClick={() => notify(`Cita de ${cita.paciente} confirmada`)} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100">
                      Confirmar
                    </button>
                    <button type="button" onClick={() => openModal(`Reagendar cita de ${cita.paciente}`)} className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100">
                      Reagendar
                    </button>
                  </>
                )}
                {necesitaReagenda && (
                  <button type="button" onClick={() => openModal(`Reagendar cita de ${cita.paciente}`)} className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100">
                    Reagendar
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {cargando && (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin" /> Consultando Supabase...
          </div>
        )}
        {!cargando && error && (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <AlertCircle size={20} className="text-amber-500" />
            <p className="text-xs text-slate-500">No se pudieron cargar las citas: {error}</p>
          </div>
        )}
        {!cargando && !error && citasFiltradas.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            {citas.length === 0 ? 'No hay citas registradas en la base de datos.' : 'No hay citas en esta categoría.'}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        {filtroActivo === 'Actuales'
          ? 'Mostrando la próxima cita'
          : `Mostrando ${citasFiltradas.length} cita(s) · se reagendan tras ${MINUTOS_CORTESIA} min sin check-in`}
      </div>
    </div>
  )
}