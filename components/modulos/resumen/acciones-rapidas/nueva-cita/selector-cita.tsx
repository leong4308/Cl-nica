'use client'

import type { DiaDisponible, MedicoAgenda } from '@/lib/supabase/datos'
import { CAMPO, ETIQUETA } from '../../../compartidos/modal-marco'

type PropsSelectorCita = {
  cargando: boolean
  cargandoAgenda: boolean
  medicos: MedicoAgenda[]
  medicoId: number | null
  onMedico: (id: number) => void
  dias: DiaDisponible[]
  diaActual: DiaDisponible | null
  fecha: string
  onFecha: (fecha: string) => void
  horario: string
  onHorario: (slot: string) => void
  error: string
}

/** Selector de médico y horario libre. Todo viene de Supabase.
 *  El paciente se elige con `BuscadorPacienteCita`, que se muestra arriba. */
export function SelectorCita({
  cargando, cargandoAgenda, medicos, medicoId, onMedico,
  dias, diaActual, fecha, onFecha, horario, onHorario, error,
}: PropsSelectorCita) {
  // Mientras carga no se muestra nada: así el modal no aparece a medias.
  if (cargando) return null

  if (medicos.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        No hay médicos registrados en la base de datos.
      </p>
    )
  }

  return (
    <>
      <label className={ETIQUETA}>
        Médico y especialidad
        <select
          aria-label="Médico y especialidad"
          value={medicoId ?? ''}
          onChange={(e) => onMedico(Number(e.target.value))}
          className={CAMPO}
        >
          {medicos.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre} · {m.especialidad}</option>
          ))}
        </select>
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <p className="text-xs font-semibold text-slate-700">Fechas y horarios disponibles</p>

        {/* Al cambiar de médico se mantiene lo que había, atenuado y sin clics,
            en vez de dejar el recuadro vacío mientras llega la nueva agenda. */}
        {dias.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">Este médico no tiene horarios libres por ahora.</p>
        ) : (
          <div className={cargandoAgenda ? 'pointer-events-none opacity-40 transition-opacity' : 'transition-opacity'}>
            {/* Los días y las horas van en bloques separados, con su rótulo y una
                línea que los corta: en dos rejillas de 3 columnas seguidas se leía
                como una sola lista mezclada. */}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Día</p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {dias.map((dia) => (
                <button
                  type="button"
                  key={dia.fecha}
                  onClick={() => onFecha(dia.fecha)}
                  aria-pressed={fecha === dia.fecha}
                  className={`rounded-lg border px-2 py-2 text-center text-xs ${
                    fecha === dia.fecha
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span className="block font-semibold text-slate-800">{dia.etiqueta}</span>
                </button>
              ))}
            </div>

            {!!diaActual?.slots.length && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Hora del {diaActual.etiqueta}
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {diaActual.slots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => onHorario(slot)}
                      aria-pressed={horario === slot}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                        horario === slot
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {horario && (
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            Horario seleccionado: {fecha} · {horario}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </>
  )
}
