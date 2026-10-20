'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  History,
  Pill,
  Send,
  Stethoscope,
  User,
  X,
} from 'lucide-react'
import {
  actualizarEstadoCita,
  cargarExpedienteCita,
  cargarHistorialPaciente,
  cargarPerfilPaciente,
  guardarExpediente,
  obtenerCita,
  solicitarReagenda,
  type CitaDetalle,
  type HistorialPaciente,
  type PerfilPacienteDetalle,
} from '@/lib/supabase/datos'
import {
  guardarHistorialPacienteEnCache,
  obtenerDatosCitaInicial,
} from '@/lib/supabase/cache-detalle-cita'
import {
  leerPerfilPacienteEnCache,
  registrarPerfilPacienteEnCache,
} from '@/lib/supabase/cache-pacientes'
import { FichaImportantePaciente } from '@/components/modulos/pacientes/ficha-importante-paciente'

type TabActivo = 'consulta' | 'historial'

const ESTILO_ESTADO: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Pendiente' },
  confirmada: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Confirmada' },
  atendida: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Atendida' },
  cancelada_paciente: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Cancelada' },
  cancelada_medico: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Cancelada por médico' },
  no_asistio: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', label: 'No asistió' },
}

function formatoHora12(fechaIso: string): string {
  try {
    const d = new Date(fechaIso)
    if (isNaN(d.getTime())) return ''
    let h = d.getHours()
    const m = d.getMinutes().toString().padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    const h12 = h ? h : 12
    return `${h12}:${m} ${ampm}`
  } catch {
    return ''
  }
}

function formatoFechaHermosa(fechaIso: string): string {
  try {
    const d = new Date(fechaIso)
    if (isNaN(d.getTime())) return ''
    const texto = d.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return texto.replace(/\b([a-záéíóúñ])/gi, (m) => m.toUpperCase())
  } catch {
    return ''
  }
}

export function ModalDetalleCita({
  citaId,
  onClose,
  tabInicial = 'consulta',
}: {
  citaId: number
  onClose: () => void
  tabInicial?: TabActivo
}) {
  // Carga síncrona inmediata desde memoria (0 milisegundos de espera)
  const datosIniciales = obtenerDatosCitaInicial(citaId)

  const [cita, setCita] = useState<CitaDetalle | null>(datosIniciales.cita)
  const [error, setError] = useState<string | null>(datosIniciales.error)
  const [tabActivo, setTabActivo] = useState<TabActivo>(tabInicial)

  // Formulario clínico
  const [diagnostico, setDiagnostico] = useState(datosIniciales.expediente?.diagnostico ?? '')
  const [receta, setReceta] = useState(datosIniciales.expediente?.receta ?? '')
  const [notas, setNotas] = useState(datosIniciales.expediente?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  // Historial
  const [historial, setHistorial] = useState<HistorialPaciente[] | null>(datosIniciales.historial)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [perfilPaciente, setPerfilPaciente] = useState<PerfilPacienteDetalle | null>(() =>
    cita?.pacienteId ? leerPerfilPacienteEnCache(cita.pacienteId) : null
  )

  // Reagenda
  const [solicitandoReagenda, setSolicitandoReagenda] = useState(false)

  useEffect(() => {
    let cancelada = false

    // Cargar perfil paciente si tenemos pacienteId para signos vitales y alertas
    if (cita?.pacienteId && !perfilPaciente) {
      void cargarPerfilPaciente(cita.pacienteId).then(({ perfil }) => {
        if (cancelada) return
        if (perfil) {
          setPerfilPaciente(perfil)
          registrarPerfilPacienteEnCache(perfil)
        }
      })
    }

    // Si ya tenemos pacienteId y no hay historial cargado, solicitarlo de inmediato
    if (cita?.pacienteId && historial === null && !cargandoHistorial) {
      setCargandoHistorial(true)
      void cargarHistorialPaciente(cita.pacienteId).then((res) => {
        if (cancelada) return
        setCargandoHistorial(false)
        if (!res.error && res.filas) {
          setHistorial(res.filas)
          guardarHistorialPacienteEnCache(cita.pacienteId, res.filas)
        }
      })
    }

    // Si no tenemos datos completos (por ejemplo viene de cache rápido), consultar en segundo plano sin bloquear
    if (!datosIniciales.expediente) {
      void obtenerCita(citaId).then(({ cita: datosCita, error: errCita }) => {
        if (cancelada) return
        if (errCita) {
          if (!cita) setError(errCita)
          return
        }
        if (datosCita) {
          setCita((prev) => (prev ? { ...prev, ...datosCita } : datosCita))

          // Cargar historial si faltaba el pacienteId
          if (historial === null && datosCita.pacienteId) {
            setCargandoHistorial(true)
            void cargarHistorialPaciente(datosCita.pacienteId).then((res) => {
              if (cancelada) return
              setCargandoHistorial(false)
              if (!res.error && res.filas) {
                setHistorial(res.filas)
                guardarHistorialPacienteEnCache(datosCita.pacienteId, res.filas)
              }
            })
          }
        }
      })

      if (tabInicial !== 'historial') {
        void cargarExpedienteCita(citaId).then(({ expediente }) => {
          if (cancelada) return
          if (expediente) {
            setDiagnostico(expediente.diagnostico)
            setReceta(expediente.receta)
            setNotas(expediente.notas)
          }
        })
      }
    }

    return () => {
      cancelada = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citaId])

  const cargarHistorial = () => {
    if (!cita?.pacienteId || historial !== null || cargandoHistorial) return
    setCargandoHistorial(true)
    void cargarHistorialPaciente(cita.pacienteId).then((res) => {
      setCargandoHistorial(false)
      if (!res.error && res.filas) {
        setHistorial(res.filas)
        guardarHistorialPacienteEnCache(cita.pacienteId, res.filas)
      }
    })
  }

  const handleCambiarTab = (tab: TabActivo) => {
    setTabActivo(tab)
    if (tab === 'historial') {
      cargarHistorial()
    }
  }

  const handleGuardarExpediente = async (concluir = false) => {
    if (!cita) return
    setGuardando(true)
    setError(null)
    setMensajeExito('')

    const { error: errExpediente } = await guardarExpediente({
      citaId: cita.id,
      diagnostico,
      receta,
      notas,
    })

    if (errExpediente) {
      setError(`No se pudo guardar: ${errExpediente}`)
      setGuardando(false)
      return
    }

    if (concluir && cita.estado !== 'atendida') {
      const { error: errEstado } = await actualizarEstadoCita(cita.id, 'atendida')
      if (errEstado) {
        setError(`Expediente guardado, pero no se pudo cambiar el estado: ${errEstado}`)
        setGuardando(false)
        return
      }
      setCita((prev) => (prev ? { ...prev, estado: 'atendida' } : prev))
      setMensajeExito('Consulta concluida y expediente guardado con éxito.')
    } else {
      setMensajeExito('Expediente clínico actualizado correctamente.')
    }

    setGuardando(false)
    window.setTimeout(() => setMensajeExito(''), 3000)
  }

  const handleSolicitarReagenda = async () => {
    if (!cita) return
    setSolicitandoReagenda(true)
    setError(null)

    const { error: err } = await solicitarReagenda(
      cita.id,
      'Solicitud del médico desde la consulta médica',
    )

    setSolicitandoReagenda(false)
    if (err) {
      setError(`No se pudo solicitar reagenda: ${err}`)
      return
    }

    setMensajeExito('Solicitud de reagenda enviada a recepción.')
    setCita((prev) => (prev ? { ...prev, motivoCancelacion: 'reagenda' } : prev))
    window.setTimeout(() => setMensajeExito(''), 3000)
  }

  if (error && !cita) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <h3 className="text-sm font-bold text-slate-900">Error al cargar la cita</h3>
          <p className="mt-2 text-xs text-rose-600">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  const fechaFormato = cita?.inicio ? formatoFechaHermosa(cita.inicio) : 'Fecha no especificada'
  const horaInicio = cita?.inicio ? formatoHora12(cita.inicio) : ''
  const horaFin = cita?.fin ? formatoHora12(cita.fin) : horaInicio

  const iniciales = (cita?.paciente ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  const estadoKey = cita?.estado?.toLowerCase() ?? 'pendiente'
  const infoEstado = ESTILO_ESTADO[estadoKey] ?? {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    label: (cita?.estado ?? 'Pendiente').toUpperCase(),
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="my-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cabecera / Ficha del Paciente */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {tabInicial !== 'historial' && (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm shadow-blue-200">
                  {iniciales || <User size={20} />}
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{cita?.paciente ?? 'Paciente'}</h3>
                  <span
                    className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${infoEstado.bg} ${infoEstado.text}`}
                  >
                    {infoEstado.label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Médico a cargo: <span className="font-semibold text-slate-700">{cita?.medico ?? '—'}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Datos rápidos de horario y fecha en formato 12 horas */}
          <div className="mt-3.5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <CalendarDays size={14} className="text-blue-600" />
              {fechaFormato}
            </span>
            {horaInicio && (
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={14} className="text-blue-600" />
                {horaInicio} - {horaFin}
              </span>
            )}
          </div>
        </div>

        {/* Pestañas: Solo si no es vista directa de historial */}
        {tabInicial !== 'historial' && (
          <div className="flex border-b border-slate-100 bg-white px-5 pt-2">
            <button
              type="button"
              onClick={() => handleCambiarTab('consulta')}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-semibold transition-colors ${
                tabActivo === 'consulta'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Stethoscope size={15} />
              Consulta médica y Receta
            </button>
            <button
              type="button"
              onClick={() => handleCambiarTab('historial')}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-semibold transition-colors ${
                tabActivo === 'historial'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History size={15} />
              Historial clínico previo
            </button>
          </div>
        )}

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {mensajeExito && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 size={15} className="text-emerald-600" />
              {mensajeExito}
            </div>
          )}

          {tabActivo === 'consulta' && cita && (
            <div className="space-y-4">
              {cita.motivoCancelacion?.toLowerCase().includes('reagendada por recepción') && (
                <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 shadow-2xs">
                  <span className="size-2 rounded-full bg-blue-600 shrink-0" />
                  <span>
                    <strong>Reagenda confirmada por recepción:</strong> Esta cita fue reprogramada a este nuevo horario.
                  </span>
                </div>
              )}

              {/* Ficha Importante / Signos Vitales y Alertas de Triage */}
              {cita.pacienteId && (
                <FichaImportantePaciente
                  pacienteId={cita.pacienteId}
                  notasMedicasRaw={perfilPaciente?.notasMedicas}
                  onActualizado={(nuevaFicha) => {
                    setPerfilPaciente((prev) => (prev ? { ...prev, notasMedicas: JSON.stringify(nuevaFicha) } : null))
                  }}
                />
              )}

              {/* Tarjeta del Motivo de Consulta */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Motivo de la consulta
                </span>
                <p className="mt-1 text-xs font-medium text-slate-800">
                  {cita.motivo ?? 'Consulta médica general'}
                </p>
              </div>

              {/* Diagnóstico médico */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <FileText size={14} className="text-blue-600" />
                  Diagnóstico médico
                </label>
                <textarea
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  rows={2}
                  placeholder="Ej: Faringitis aguda bacteriana, lumbalgia mecánica, etc..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Tratamiento y Receta médica */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Pill size={14} className="text-emerald-600" />
                  Tratamiento y Receta médica
                </label>
                <textarea
                  value={receta}
                  onChange={(e) => setReceta(e.target.value)}
                  rows={3}
                  placeholder="Ej: Amoxicilina 500mg cada 8 horas por 7 días. Paracetamol 500mg cada 6 hrs en caso de dolor o fiebre."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Notas y observaciones clínicas */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <FileCheck2 size={14} className="text-amber-600" />
                  Notas de evolución y observaciones
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Observaciones de exploración física, signos vitales o indicaciones de seguimiento..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>
          )}

          {tabActivo === 'historial' && (
            <div>
              {cargandoHistorial ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Cargando antecedentes del paciente...
                </div>
              ) : historial !== null && historial.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Este paciente no tiene antecedentes ni consultas previas registradas.
                </div>
              ) : (
                <div className="space-y-3">
                  {historial?.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-xs text-slate-900">{item.motivo}</span>
                        <span className="text-[11px] text-slate-400">{item.fecha}</span>
                      </div>
                      <div className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                        <p>
                          <span className="font-semibold text-slate-800">Diagnóstico:</span>{' '}
                          {item.diagnostico}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">Receta:</span>{' '}
                          {item.receta}
                        </p>
                        {item.notas && (
                          <p className="text-slate-500">
                            <span className="font-semibold text-slate-700">Notas:</span>{' '}
                            {item.notas}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400">
                          Atendió: {item.medico}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie con acciones */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <button
              type="button"
              disabled={solicitandoReagenda}
              onClick={handleSolicitarReagenda}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 transition-colors"
            >
              <Send size={13} />
              Solicitar reagenda a recepción
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cerrar
            </button>

            {tabActivo === 'consulta' && (
              <>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => handleGuardarExpediente(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  Guardar expediente
                </button>

                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => handleGuardarExpediente(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95"
                >
                  <CheckCircle2 size={14} />
                  Concluir y Atender Cita
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}