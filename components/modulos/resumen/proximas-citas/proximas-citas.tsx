'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock3 } from 'lucide-react'
import type { ClinicActions } from '../../compartidos/types'
import { RowActions } from '../../compartidos/ui'
import { cargarCitasPanel, type CitaPanel } from '@/lib/supabase/datos'
import { guardarPanel, leerPanel } from '@/lib/supabase/cache-modulos'

/** Minutos de cortesía para el check-in antes de pasar la cita a "Reagendar". */
const MINUTOS_CORTESIA = 10

/** Estados finales: la cita ya se resolvió — atendida, cancelada o marcada
 *  como no asistió — así que sale del panel de check-in y no se cuenta como
 *  pendiente de confirmar. Antes se reconvertían en "Confirmada" y volvían a
 *  aparecer en la pestaña "Actuales" como si siguieran vigentes. */
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
 *
 * Devuelve `null` cuando la cita ya tiene un estado final: no es una de las
 * tres pestañas, simplemente sale del panel.
 */
function estadoDe(cita: CitaPanel, ahoraMs: number): EstadoPanel | null {
  if (ESTADOS_FINALES.has(cita.estado)) return null
  const transcurridos = (ahoraMs - cita.inicio) / 60_000
  if (transcurridos < 0) return 'Confirmada'
  if (transcurridos <= MINUTOS_CORTESIA) return 'Pendiente'
  return 'Reagendar'
}

/** Filtros de la interfaz. `estado` es el valor real que devuelve `estadoDe`,
 *  por eso se declara aparte del texto visible ("Pendientes" vs "Pendiente").
 *  No existe un filtro "Todas": cada cita pertenece a un único estado y así
 *  las que hay que reagendar nunca se mezclan con las confirmadas. */
const FILTROS = [
  { etiqueta: 'Actuales', estado: 'Confirmada' },
  { etiqueta: 'Pendientes', estado: 'Pendiente' },
  { etiqueta: 'Reagendar', estado: 'Reagendar' },
] as const satisfies ReadonlyArray<{ etiqueta: string; estado: EstadoPanel }>

type Filtro = (typeof FILTROS)[number]['etiqueta']

type PropsPanel = ClinicActions & {
  ahora: Date
  /** Abre el modal de acciones sobre una cita concreta. */
  onAccion: (cita: CitaPanel, accion: 'detalle' | 'reagendar') => void
}

/** "2026-10-03" a partir de un Date, en hora local (igual que `aIso` de datos.ts). */
function aIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Encabezado de cada bloque del panel: "Hoy", "Mañana" o "lunes, 5 de octubre".
 *
 * Se lee la fecha al mediodía a propósito: a medianoche un desfase de zona
 * horaria podría dejar el rótulo en el día anterior. */
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
  // La lista ya viene precargada al entrar, así que el panel pinta de inmediato.
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
      // Aun con la caché se relee: el resumen debe reflejar lo recién guardado.
      cargarCitasPanel().then((resultado) => {
        if (!vigente) return
        setCitas(resultado.filas)
        setError(resultado.error)
        setCargando(false)
        guardarPanel(resultado.filas, resultado.error)
      })
    }
    leer()
    // Al guardar una cita se relee desde Supabase en vez de agregar la fila a mano.
    window.addEventListener('datos-actualizados', leer)
    return () => { vigente = false; window.removeEventListener('datos-actualizados', leer) }
  }, [])

  // El panel reúne lo que viene a continuación: el resto del día de hoy y los
  // días siguientes. Antes miraba únicamente el día en curso, y como la agenda
  // de los médicos solo corre de lunes a viernes el panel salía siempre vacío el
  // fin de semana aunque se acabara de agendar una cita para el lunes. Se compara
  // contra el campo `fecha`, que ya viene en hora local, para no cambiar de día
  // por la zona horaria.
  const hoyIso = aIsoLocal(ahora)
  const mananaIso = aIsoLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1))
  const hoyLegible = ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  // `fecha` es "AAAA-MM-DD", así que comparar textos ya ordena por día.
  const proximas = citas.filter((cita) => cita.fecha >= hoyIso)
  // Las que ya están atendidas, canceladas o marcadas como no asistió se
  // descartan antes de clasificar: son las que salen del panel.
  const clasificadas = proximas
    .map((cita) => ({ cita, estado: estadoDe(cita, ahoraMs) }))
    .filter((item): item is { cita: CitaPanel; estado: EstadoPanel } => item.estado !== null)
  const cuenta = (estado: EstadoPanel) => clasificadas.filter((item) => item.estado === estado).length

  const filtro = FILTROS.find((item) => item.etiqueta === filtroActivo) ?? FILTROS[0]

  // Cada filtro muestra únicamente su estado: no hay "todas" que mezcle las
  // citas vencidas con las que ya están confirmadas.
  const citasFiltradas = clasificadas
    .filter((item) => item.estado === filtro.estado)
    .sort((a, b) => a.cita.inicio - b.cita.inicio)

  // Un bloque por día, en orden cronológico: primero lo que resta de hoy y
  // después lo de mañana y los días siguientes. Un `Map` conserva el orden de
  // inserción, y como la lista ya viene ordenada, los bloques salen de más
  // antiguo a más reciente.
  const bloques = new Map<string, typeof citasFiltradas>()
  for (const item of citasFiltradas) {
    const delDia = bloques.get(item.cita.fecha)
    if (delDia) delDia.push(item)
    else bloques.set(item.cita.fecha, [item])
  }

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
            <p className="mt-0.5 text-xs text-slate-400">Hoy, {hoyLegible} · próximas y check-in</p>
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
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${filtroActivo === item.etiqueta
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
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${filtroActivo === 'Reagendar' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
          >
            Reagendar ({cuenta('Reagendar')})
          </button>
        </div>
      </div>

      <div>
        {/* Un bloque por día: primero lo que resta de hoy, luego los días
            siguientes. Así se ve de un vistazo qué dejó de hacerse hoy y qué
            viene mañana. */}
        {[...bloques.entries()].map(([fecha, delDia]) => (
          <section key={fecha}>
            <h4 className="bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {tituloDia(fecha, hoyIso, mananaIso)} · {delDia.length} cita(s)
            </h4>
            <div className="divide-y divide-slate-100">
              {delDia.map(({ cita, estado }) => {
                const necesitaReagenda = estado === 'Reagendar'
                const estaPendiente = estado === 'Pendiente'
                // "Confirmar" y "Reagendar" son acciones de la pestaña "Reagendar";
                // en "Actuales" y "Pendientes" la fila es solo de consulta.
                const muestraAcciones = filtroActivo === 'Reagendar' && necesitaReagenda
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
                      <RowActions
                        onView={() => onAccion(cita, 'detalle')}
                        {...(muestraAcciones ? { onEdit: () => onAccion(cita, 'reagendar') } : {})}
                      />
                      {muestraAcciones && (
                        <>
                          <button
                            type="button"
                            onClick={() => onAccion(cita, 'detalle')}
                            className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => onAccion(cita, 'reagendar')}
                            className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                          >
                            Reagendar
                          </button>
                        </>
                      )}
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
        {/* El pie compara la pestaña activa contra todas las citas próximas sin
            resolver, así nunca dice "0 citas" cuando sí hay agenda. */}
        {`${citasFiltradas.length} de ${clasificadas.length} cita(s) próximas por resolver · se reagendan tras ${MINUTOS_CORTESIA} min sin check-in`}
      </div>
    </div>
  )
}