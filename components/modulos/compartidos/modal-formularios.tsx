'use client'

import { useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import { Search } from 'lucide-react'
import type { DiaDisponible, MedicoAgenda } from '@/lib/supabase/datos'

const CAMPO = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
const ETIQUETA = 'text-sm font-medium'

type FormUsuario = {
  nombre: string
  email: string
  password: string
  rol: string
  especialidad: string
  cedula: string
  duracion: string
  fechaNacimiento: string
  genero: string
  telefono: string
}

type PropsFormularioUsuario = {
  usuario: FormUsuario
  setUsuario: Dispatch<SetStateAction<FormUsuario>>
  mensaje: string
  guardando: boolean
  onCrear: () => void
}

export function FormularioUsuario({ usuario, setUsuario, mensaje, guardando, onCrear }: PropsFormularioUsuario) {
  const campo = <T extends keyof FormUsuario>(clave: T) => ({
    value: usuario[clave],
    onChange: (e: { target: { value: string } }) => setUsuario({ ...usuario, [clave]: e.target.value }),
  })

  return (
    <>
      <label className={ETIQUETA}>
        Nombre
        <input {...campo('nombre')} className={CAMPO} placeholder="Dra. Ana López" />
      </label>
      <label className={ETIQUETA}>
        Correo
        <input {...campo('email')} type="email" className={CAMPO} placeholder="ana@clinicanova.com" />
      </label>
      <label className={ETIQUETA}>
        Contraseña
        <input {...campo('password')} type="password" className={CAMPO} placeholder="Mínimo 6 caracteres" />
      </label>
      <label className={ETIQUETA}>
        Rol
        <select {...campo('rol')} className={CAMPO}>
          <option value="medico">Médico</option>
          <option value="enfermero">Enfermero</option>
          <option value="recepcionista">Recepcionista</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <p className="-mt-1 text-xs text-slate-400">
        Los pacientes se registran en el módulo Pacientes, no como cuentas de acceso.
      </p>

      {usuario.rol === 'medico' && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-blue-700">Datos del médico</p>
          <div className="flex flex-col gap-3">
            <label className={ETIQUETA}>
              Especialidad
              <input {...campo('especialidad')} className={`${CAMPO} bg-white`} placeholder="Cardiología" />
            </label>
            <label className={ETIQUETA}>
              Cédula profesional
              <input {...campo('cedula')} className={`${CAMPO} bg-white`} placeholder="CED-0042" />
            </label>
            <label className={ETIQUETA}>
              Duración de consulta (min)
              <input {...campo('duracion')} type="number" min="5" max="120" className={`${CAMPO} bg-white`} />
            </label>
          </div>
        </div>
      )}

      {usuario.rol === 'enfermero' && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-emerald-700">Datos del enfermero</p>
          <div className="flex flex-col gap-3">
            <label className={ETIQUETA}>
              Especialidad
              <input {...campo('especialidad')} className={`${CAMPO} bg-white`} placeholder="Enfermería clínica" />
            </label>
          </div>
        </div>
      )}

      {mensaje && (
        <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{mensaje}</p>
      )}

      <button
        type="button"
        onClick={onCrear}
        disabled={guardando}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Crear usuario
      </button>
    </>
  )
}

type Paciente = {
  nombre: string
  identificacion: string
  pass: string
  telefono: string
  estado: string
}

type PropsBuscador = {
  value: string
  onChange: (valor: string) => void
  resultados: Paciente[]
  resultadoActivo: number
  seleccionado: boolean
  onTeclado: (event: KeyboardEvent<HTMLInputElement>) => void
  onSeleccionar: (nombre: string) => void
}

export function BuscadorPaciente({
  value, onChange, resultados, resultadoActivo, seleccionado, onTeclado, onSeleccionar,
}: PropsBuscador) {
  return (
    <>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onTeclado}
          aria-label="Buscar paciente"
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Nombre, identificación o teléfono"
        />
        {value && !seleccionado && resultados.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {resultados.map((paciente, i) => (
              <button
                key={paciente.identificacion}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSeleccionar(paciente.nombre) }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 ${i === resultadoActivo ? 'bg-blue-50' : ''}`}
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{paciente.nombre}</span>
                  <span className="block text-xs text-slate-500">{paciente.pass} · {paciente.telefono}</span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">{paciente.estado}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {seleccionado && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          Paciente seleccionado: {value}
        </p>
      )}
    </>
  )
}

type PacienteCita = { id: number; nombre: string }

type PropsBuscadorCita = {
  pacientes: PacienteCita[]
  seleccionadoId: number | null
  onSeleccionar: (id: number) => void
}

/**
 * Buscador de paciente para "Nueva cita".
 * A diferencia del buscador general, devuelve el `id` del paciente porque es
 * el valor que necesita `citas.paciente_id` en Supabase.
 */
export function BuscadorPacienteCita({ pacientes, seleccionadoId, onSeleccionar }: PropsBuscadorCita) {
  const [texto, setTexto] = useState('')
  const [activo, setActivo] = useState(0)
  const [abierto, setAbierto] = useState(false)

  const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const coincidencias = pacientes
    .filter((p) => normalizar(p.nombre).includes(normalizar(texto)))
    .slice(0, 6)

  const seleccionado = pacientes.find((p) => p.id === seleccionadoId) ?? null

  function elegir(paciente: PacienteCita) {
    onSeleccionar(paciente.id)
    setTexto('')
    setAbierto(false)
    setActivo(0)
  }

  function alTeclado(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActivo((a) => Math.min(a + 1, coincidencias.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActivo((a) => Math.max(a - 1, 0))
    }
    if (event.key === 'Enter' && coincidencias[activo]) {
      event.preventDefault()
      elegir(coincidencias[activo])
    }
    if (event.key === 'Escape') setAbierto(false)
  }

  if (seleccionado) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
        <p className="text-xs font-semibold text-emerald-800">Paciente seleccionado</p>
        <p className="mt-0.5 text-sm font-medium text-emerald-900">{seleccionado.nombre}</p>
        <button
          type="button"
          onClick={() => onSeleccionar(0)}
          className="mt-2 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          Cambiar paciente
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <label className="text-sm font-medium" htmlFor="buscar-paciente-cita">
        Paciente
      </label>
      <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-slate-400" />
      <input
        id="buscar-paciente-cita"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(0) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
        onKeyDown={alTeclado}
        autoComplete="off"
        placeholder="Escribe el nombre del paciente"
        className="mt-1 w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {abierto && texto && (
        coincidencias.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {coincidencias.map((paciente, i) => (
              <li key={paciente.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); elegir(paciente) }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${i === activo ? 'bg-blue-50' : ''}`}
                >
                  {paciente.nombre}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
            Sin coincidencias
          </p>
        )
      )}
    </div>
  )
}

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
}: Omit<PropsSelectorCita, 'pacientes' | 'pacienteId' | 'onPaciente'>) {
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
            <div className="mt-3 grid grid-cols-3 gap-2">
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
                  <span className="mt-0.5 block text-[11px] text-slate-500">{dia.fechaCorta}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {diaActual?.slots.map((slot) => (
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

        {horario && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
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
