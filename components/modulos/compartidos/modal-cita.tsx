'use client'

import { useEffect, useState } from 'react'
import { UserRound, X } from 'lucide-react'
import {
  cargarDisponibilidad,
  reagendarCita,
  type CitaPanel,
  type DiaDisponible,
} from '@/lib/supabase/datos'
import { actualizarAgendaEnCache, leerAgendaEnCache } from '@/lib/supabase/cache-cita'

export type AccionCita = 'detalle' | 'reagendar'

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

/**
 * Modal de acciones sobre una cita.
 * - `detalle`   muestra la ficha y deja confirmar / registrar / no asistió / cancelar.
 * - `reagendar` deja elegir otra fecha y hora usando la agenda real del médico.
 */
export function ModalAccionCita({
  cita, accion, onClose, onConfirmar, onRegistrar, onNoAsistio, onCancelar,
}: PropsModalCita) {
  const [trabajando, setTrabajando] = useState<Accion>('')
  const [error, setError] = useState('')

  // ─── Estado de reagendar ───
  // La agenda del médico suele estar precargada, así que el modal abre completo.
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

  /** Ejecuta una acción de escritura. Devuelve el error o null si salió bien. */
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

  const titulo = accion === 'reagendar' ? 'Reagendar cita' : 'Detalle de la cita'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-cita-title" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 id="modal-cita-title" className="text-lg font-bold">{titulo}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        {/* Ficha de la cita */}
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

        {accion === 'reagendar' ? (
          <>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-700">Nueva fecha y hora</p>
              {cargandoAgenda ? null : dias.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Este médico no tiene horarios libres por ahora.</p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {dias.map((dia) => (
                      <button type="button" key={dia.fecha} onClick={() => { setFecha(dia.fecha); setHora('') }} aria-pressed={fecha === dia.fecha} className={`rounded-lg border px-2 py-2 text-center text-xs ${fecha === dia.fecha ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'}`}>
                        <span className="block font-semibold text-slate-800">{dia.etiqueta}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{dia.fechaCorta}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {dias.find((d) => d.fecha === fecha)?.slots.map((slot) => (
                      <button type="button" key={slot} onClick={() => setHora(slot)} aria-pressed={hora === slot} className={`rounded-lg border px-2 py-2 text-xs font-medium ${hora === slot ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancelar</button>
              <button type="button" onClick={confirmarReagenda} disabled={trabajando !== '' || !hora} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                Guardar nueva fecha
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-700">Acciones</p>
            <div className="grid grid-cols-2 gap-2">
              <BotonAccion etiqueta="Confirmar" color="bg-emerald-600" cargando={trabajando === 'confirmar'} onClick={() => ejecutar('confirmar', onConfirmar)} />
              <BotonAccion etiqueta="Registrar asistencia" color="bg-blue-600" cargando={trabajando === 'registrar'} onClick={() => ejecutar('registrar', onRegistrar)} />
              <BotonAccion etiqueta="No asistió" color="bg-amber-600" cargando={trabajando === 'noasistio'} onClick={() => ejecutar('noasistio', onNoAsistio)} />
              <BotonAccion etiqueta="Cancelar cita" color="bg-red-600" cargando={trabajando === 'cancelar'} onClick={() => ejecutar('cancelar', onCancelar)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type PropsBotonAccion = {
  etiqueta: string
  color: string
  cargando: boolean
  onClick: () => void
}

function BotonAccion({ etiqueta, color, cargando, onClick }: PropsBotonAccion) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${color}`}
    >
      {etiqueta}
    </button>
  )
}