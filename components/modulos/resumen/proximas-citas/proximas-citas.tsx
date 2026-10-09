'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock3 } from 'lucide-react'
import type { ClinicActions } from '../../compartidos/types'
import { BotonVerAgendaCompleta } from './ver-agenda-completa'
import { BotonActuales } from './actuales'
import { BotonPendientes } from './pendientes'
import { BotonReagendar } from './reagendar'
import { AccionesCitaFila } from './acciones-fila'
import { cargarCitasPanel, type CitaPanel } from '@/lib/supabase/datos'
import { guardarPanel, leerPanel } from '@/lib/supabase/cache-modulos'

const MINUTOS_CORTESIA = 10

const ESTADOS_FINALES = new Set([
  'Atendida',
  'No asistió',
  'Cancelada por paciente',
  'Cancelada por médico',
])

type EstadoPanel = 'Confirmada' | 'Pendiente' | 'Reagendar'

function estadoDe(cita: CitaPanel, ahoraMs: number): EstadoPanel | null {
  if (ESTADOS_FINALES.has(cita.estado)) return null
  const transcurridos = (ahoraMs - cita.inicio) / 60_000
  if (transcurridos < 0) return 'Confirmada'
  if (transcurridos <= MINUTOS_CORTESIA) return 'Pendiente'
  return 'Reagendar'
}

const FILTROS = [
  { etiqueta: 'Actuales', estado: 'Confirmada' },
  { etiqueta: 'Pendientes', estado: 'Pendiente' },
  { etiqueta: 'Reagendar', estado: 'Reagendar' },
] as const satisfies ReadonlyArray<{ etiqueta: string; estado: EstadoPanel }>

type Filtro = (typeof FILTROS)[number]['etiqueta']

function BotonesFiltros({
  filtroActivo, alElegir, cuenta,
}: {
  filtroActivo: Filtro
  alElegir: (filtro: Filtro) => void
  cuenta: (estado: EstadoPanel) => number
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 pb-1">
      <BotonActuales
        total={cuenta('Confirmada')}
        activo={filtroActivo === 'Actuales'}
        onElegir={() => alElegir('Actuales')}
      />
      <BotonPendientes
        total={cuenta('Pendiente')}
        activo={filtroActivo === 'Pendientes'}
        onElegir={() => alElegir('Pendientes')}
      />
      <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
      <BotonReagendar
        total={cuenta('Reagendar')}
        activo={filtroActivo === 'Reagendar'}
        onElegir={() => alElegir('Reagendar')}
      />
    </div>
  )
}

type PropsPanel = ClinicActions & {
  ahora: Date
  onAccion: (cita: CitaPanel, accion: 'detalle' | 'reagendar' | 'historial') => void
}

function aIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tituloDia(fecha: string, hoyIso: string, mananaIso: string): string {
  if (fecha === hoyIso) return 'Hoy'
  if (fecha === mananaIso) return 'Mañana'
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia, 12).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function ProximasCitas({ ahora, navigate, onAccion }: PropsPanel) {
  const [filtroActivo, setFiltroActivo] = useState<Filtro>('Reagendar')
  const panelInicial = leerPanel()
  const [citas, setCitas] = useState<CitaPanel[]>(panelInicial?.filas ?? [])
  const [cargando, setCargando] = useState(panelInicial === null)
  const [error, setError] = useState<string | null>(panelInicial?.error ?? null)

  const ahoraMs = ahora.getTime()

  useEffect(() => {
    let vigente = true
    const leer = () => {
      const guardado = leerPanel()
      if (guardado) {
        setCitas(guardado.filas)
        setError(guardado.error)
        setCargando(false)
      } else {
        setCargando(true)
      }
      cargarCitasPanel().then((resultado) => {
        if (!vigente) return
        setCitas(resultado.filas)
        setError(resultado.error)
        setCargando(false)
        guardarPanel(resultado.filas, resultado.error)
      })
    }
    leer()
    window.addEventListener('datos-actualizados', leer)
    return () => { vigente = false; window.removeEventListener('datos-actualizados', leer) }
  }, [])

  const hoyIso = aIsoLocal(ahora)
  const mananaIso = aIsoLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1))
  const hoyLegible = ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const proximas = citas.filter((cita) => cita.fecha >= hoyIso)
  const clasificadas = proximas
    .map((cita) => ({ cita, estado: estadoDe(cita, ahoraMs) }))
    .filter((item): item is { cita: CitaPanel; estado: EstadoPanel } => item.estado !== null)
  const cuenta = (estado: EstadoPanel) =>
    clasificadas.filter((item) => item.estado === estado && (estado !== 'Confirmada' || item.cita.fecha === hoyIso)).length

  const filtro = FILTROS.find((item) => item.etiqueta === filtroActivo) ?? FILTROS[0]

  const citasFiltradas = clasificadas
    .filter((item) => item.estado === filtro.estado && (filtro.estado !== 'Confirmada' || item.cita.fecha === hoyIso))
    .sort((a, b) => a.cita.inicio - b.cita.inicio)

  const bloques = new Map<string, typeof citasFiltradas>()
  for (const item of citasFiltradas) {
    const delDia = bloques.get(item.cita.fecha)
    if (delDia) delDia.push(item)
    else bloques.set(item.cita.fecha, [item])
  }

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
            <p className="mt-0.5 text-xs text-slate-400">Hoy, {hoyLegible} · próximas y check-in</p>
          </div>
          <BotonVerAgendaCompleta onVerAgenda={() => navigate('Citas')} />
        </div>

        <BotonesFiltros filtroActivo={filtroActivo} alElegir={setFiltroActivo} cuenta={cuenta} />
      </div>

      <div>
        {[...bloques.entries()].map(([fecha, delDia]) => (
          <section key={fecha}>
            <h4 className="bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {tituloDia(fecha, hoyIso, mananaIso)} · {delDia.length} cita(s)
            </h4>
            <div className="divide-y divide-slate-100">
              {delDia.map(({ cita, estado }) => {
                const necesitaReagenda = estado === 'Reagendar'
                const estaPendiente = estado === 'Pendiente'
                const muestraConfirmar = filtroActivo === 'Actuales' || filtroActivo === 'Pendientes'
                const muestraReagendar = filtroActivo === 'Pendientes' || filtroActivo === 'Reagendar'
                return (
                  <div
                    key={cita.id}
                    className={`grid gap-3 px-4 py-3 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center ${necesitaReagenda
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
                      <AccionesCitaFila cita={cita} muestraConfirmar={muestraConfirmar} muestraReagendar={muestraReagendar} onAccion={onAccion} />
                    </div>
                  </div>
                )
            })}
            </div>
          </section>
        ))}

        {cargando && <div className="px-5 py-10" />}
        {!cargando && error && (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <AlertCircle size={20} className="text-amber-500" />
            <p className="text-xs text-slate-500">No se pudieron cargar las citas: {error}</p>
          </div>
        )}
        {!cargando && !error && citasFiltradas.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            {citas.length === 0
              ? 'No hay citas registradas en la base de datos.'
              : proximas.length === 0
                ? `No hay citas a partir de hoy (${hoyLegible}).`
                : clasificadas.length === 0
                  ? `Las ${proximas.length} cita(s) de hoy en adelante ya están resueltas (atendidas, canceladas o no asistió).`
                  : `Ninguna cita en «${filtroActivo}». Hay ${clasificadas.length} cita(s) próximas repartidas en las demás pestañas.`}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        {`${citasFiltradas.length} de ${clasificadas.length} cita(s) próximas por resolver · se reagendan tras ${MINUTOS_CORTESIA} min sin check-in`}
      </div>
    </div>
  )
}