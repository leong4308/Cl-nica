'use client'

import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import {
  cargarDisponibilidad,
  cargarHistorialPaciente,
  guardarExpediente,
  reagendarCita,
  type CitaPanel,
  type DiaDisponible,
  type HistorialPaciente,
} from '@/lib/supabase/datos'
import { actualizarAgendaEnCache, leerAgendaEnCache } from '@/lib/supabase/cache-cita'
import { BotonAccionDetalle } from './detalle-cita'
import { BotonCerrarModal } from './cerrar-modal'
import { BotonesDiaReagenda, BotonesHoraReagenda, BotonCancelarReagenda, BotonGuardarReagenda } from './reagendar-cita'

export type AccionCita = 'detalle' | 'reagendar' | 'historial'

type PropsModalCita = {
  cita: CitaPanel
  accion: AccionCita
  onClose: () => void
  onConfirmar: (cita: CitaPanel) => Promise<string | null>
  onRegistrar: (cita: CitaPanel) => Promise<string | null>
  onNoAsistio: (cita: CitaPanel) => Promise<string | null>
  onCancelar: (cita: CitaPanel) => Promise<string | null>
}

type Accion = '' | 'confirmar' | 'registrar' | 'noasistio' | 'cancelar' | 'reagendar'

export function ModalAccionCita({
  cita, accion, onClose, onConfirmar, onRegistrar, onNoAsistio, onCancelar,
}: PropsModalCita) {
  const [trabajando, setTrabajando] = useState<Accion>('')
  const [error, setError] = useState('')
  const [historial, setHistorial] = useState<HistorialPaciente[] | null>(null)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [creandoExpediente, setCreandoExpediente] = useState(false)
  const [diagnostico, setDiagnostico] = useState('')
  const [receta, setReceta] = useState('')
  const [notas, setNotas] = useState('')
  const [guardandoExpediente, setGuardandoExpediente] = useState(false)
  useEffect(() => {
    setHistorial(null)
    setCargandoHistorial(false)
    setError('')
    setCreandoExpediente(false)
    setDiagnostico('')
    setReceta('')
    setNotas('')
  }, [cita.id])

  const agendaPrecargada = accion === 'reagendar' && cita.medicoId ? leerAgendaEnCache(cita.medicoId) : null
  const [dias, setDias] = useState<DiaDisponible[]>(agendaPrecargada?.filas ?? [])
  const [fecha, setFecha] = useState(agendaPrecargada?.filas[0]?.fecha ?? '')
  const [hora, setHora] = useState('')
  const [cargandoAgenda, setCargandoAgenda] = useState(agendaPrecargada === null)

  useEffect(() => {
    if (accion !== 'reagendar' || !cita.medicoId) return
    const guardada = leerAgendaEnCache(cita.medicoId)
    if (guardada) {
      setDias(guardada.filas)
      setFecha(guardada.filas[0]?.fecha ?? '')
      setError(guardada.error ?? '')
      setCargandoAgenda(false)
      return
    }
    let vigente = true
    setCargandoAgenda(true)
    cargarDisponibilidad(cita.medicoId, cita.duracionConsulta).then((resultado) => {
      if (!vigente) return
      setDias(resultado.filas)
      setFecha(resultado.filas[0]?.fecha ?? '')
      setError(resultado.error ?? '')
      setCargandoAgenda(false)
      actualizarAgendaEnCache(cita.medicoId, resultado.filas, resultado.error)
    })
    return () => { vigente = false }
  }, [accion, cita.medicoId, cita.duracionConsulta])

  async function ejecutar(nombre: Accion, fn: (c: CitaPanel) => Promise<string | null>) {
    setTrabajando(nombre)
    setError('')
    const mensajeError = await fn(cita)
    setTrabajando('')
    if (mensajeError) {
      setError(mensajeError)
      return false
    }
    return true
  }

  async function confirmarYVerHistorial() {
    const ok = await ejecutar('confirmar', onConfirmar)
    if (!ok || !cita.pacienteId) return
    setCargandoHistorial(true)
    const resultado = await cargarHistorialPaciente(cita.pacienteId)
    setCargandoHistorial(false)
    if (resultado.error) {
      setError(resultado.error)
      return
    }
    setHistorial(resultado.filas)
  }

  async function guardarNuevoExpediente() {
    if (guardandoExpediente || (!diagnostico.trim() && !receta.trim() && !notas.trim())) return
    setGuardandoExpediente(true)
    setError('')
    const resultado = await guardarExpediente({ citaId: cita.id, diagnostico, receta, notas })
    setGuardandoExpediente(false)
    if (resultado.error) {
      setError(resultado.error)
      return
    }
    setCreandoExpediente(false)
    setDiagnostico('')
    setReceta('')
    setNotas('')
    const historialNuevo = await cargarHistorialPaciente(cita.pacienteId)
    if (!historialNuevo.error) setHistorial(historialNuevo.filas)
  }

  useEffect(() => {
    if (accion !== 'historial') return
    confirmarYVerHistorial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accion, cita.id])

  async function confirmarReagenda() {
    if (!fecha || !hora) {
      setError('Elige una fecha y una hora disponibles.')
      return
    }
    const ok = await ejecutar('reagendar', async (c) => {
      const resultado = await reagendarCita(c.id, c.medicoId, c.duracionConsulta, fecha, hora)
      return resultado.error
    })
    if (ok) onClose()
  }

  const titulo = accion === 'reagendar' ? 'Reagendar cita' : accion === 'historial' ? `Historial médico · ${cita.paciente}` : 'Detalle de la cita'

  const diaElegido = dias.find((d) => d.fecha === fecha)
  const slotsDelDia = diaElegido?.slots ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-cita-title" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 id="modal-cita-title" className="text-lg font-bold">{titulo}</h3>
          <BotonCerrarModal onCerrar={onClose} />
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><UserRound size={16} /></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{cita.paciente}</p>
              <p className="truncate text-xs text-slate-500">{cita.medico}</p>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Fecha</dt><dd className="font-medium">{cita.fecha}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Hora</dt><dd className="font-medium">{cita.hora}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Motivo</dt><dd className="text-right font-medium">{cita.motivo}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Estado en base</dt><dd className="font-medium">{cita.estado}</dd></div>
          </dl>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

        {(historial !== null || cargandoHistorial) && accion !== 'reagendar' && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            {accion !== 'historial' && (
              <p className="text-xs font-bold text-emerald-800">Historial médico de {cita.paciente}</p>
            )}
            {cargandoHistorial ? (
              <p className="mt-2 text-xs text-slate-500">Cargando historial…</p>
            ) : historial !== null && historial.length === 0 ? (
              <>
                <p className="mt-2 text-xs text-slate-500">Este paciente aún no tiene expedientes anteriores.</p>
                {!creandoExpediente ? (
                  <button
                    type="button"
                    onClick={() => setCreandoExpediente(true)}
                    className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Crear nuevo expediente
                  </button>
                ) : (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    <label className="block text-xs font-semibold text-slate-700">Diagnóstico
                      <textarea
                        value={diagnostico}
                        onChange={(e) => setDiagnostico(e.target.value)}
                        rows={2}
                        placeholder="Diagnóstico del paciente"
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-normal text-slate-800 placeholder:text-slate-400"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">Receta
                      <textarea
                        value={receta}
                        onChange={(e) => setReceta(e.target.value)}
                        rows={2}
                        placeholder="Medicamentos recetados"
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-normal text-slate-800 placeholder:text-slate-400"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">Notas del doctor
                      <textarea
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        rows={2}
                        placeholder="Notas de la consulta"
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-normal text-slate-800 placeholder:text-slate-400"
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setCreandoExpediente(false)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={guardarNuevoExpediente}
                        disabled={guardandoExpediente || (!diagnostico.trim() && !receta.trim() && !notas.trim())}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {guardandoExpediente ? 'Guardando…' : 'Guardar expediente'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <ul className="mt-2 space-y-2">
                {historial?.map((item, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800">{item.motivo}</p>
                      <p className="shrink-0 text-[11px] text-slate-400">{item.fecha}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600"><span className="font-semibold">Diagnóstico:</span> {item.diagnostico}</p>
                    <p className="mt-0.5 text-xs text-slate-600"><span className="font-semibold">Receta:</span> {item.receta}</p>
                    {item.notas && <p className="mt-0.5 text-[11px] text-slate-500">Notas: {item.notas}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">Atendió: {item.medico}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {accion === 'reagendar' ? (
          <>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-700">Nueva fecha y hora</p>
              {cargandoAgenda ? null : dias.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Este médico no tiene horarios libres por ahora.</p>
              ) : (
                <>
                  <BotonesDiaReagenda dias={dias} fecha={fecha} onFecha={(nueva) => { setFecha(nueva); setHora('') }} />
                  {slotsDelDia.length > 0 && (
                    <BotonesHoraReagenda etiquetaDia={diaElegido?.etiqueta ?? ''} slots={slotsDelDia} hora={hora} onHora={setHora} />
                  )}
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <BotonCancelarReagenda onCancelar={onClose} />
              <BotonGuardarReagenda deshabilitado={trabajando !== '' || !hora} onGuardar={confirmarReagenda} />
            </div>
          </>
        ) : accion === 'historial' ? (
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-700">Acciones</p>
            <div className="grid grid-cols-2 gap-2">
              <BotonAccionDetalle etiqueta="Confirmar" color="bg-emerald-600" cargando={trabajando === 'confirmar'} onClick={confirmarYVerHistorial} />
              <BotonAccionDetalle etiqueta="Registrar asistencia" color="bg-blue-600" cargando={trabajando === 'registrar'} onClick={() => ejecutar('registrar', onRegistrar)} />
              <BotonAccionDetalle etiqueta="No asistió" color="bg-amber-600" cargando={trabajando === 'noasistio'} onClick={() => ejecutar('noasistio', onNoAsistio)} />
              <BotonAccionDetalle etiqueta="Cancelar cita" color="bg-red-600" cargando={trabajando === 'cancelar'} onClick={() => ejecutar('cancelar', onCancelar)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
