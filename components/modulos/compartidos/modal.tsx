import { useEffect, useState, type KeyboardEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  cargarClinicaActiva,
  cargarDisponibilidad,
  cargarMedicosAgenda,
  cargarPacientes,
  cargarPacientesParaCita,
  crearCita,
  type DiaDisponible,
  type MedicoAgenda,
} from '@/lib/supabase/datos'
import {
  BuscadorPaciente,
  FormularioUsuario,
  SelectorCita,
} from './modal-formularios'


const USUARIO_VACIO = {
  nombre: '', email: '', password: '', rol: 'medico',
  especialidad: '', cedula: '', duracion: '20', fechaNacimiento: '', genero: '', telefono: '',
}

type FormUsuario = typeof USUARIO_VACIO

export function ClinicModal({ title, onClose, onSave }: { title: string; onClose: () => void; onSave: (value: string) => void }) {
  const esNuevaCita = title === 'Nueva cita'
  const esBusqueda = title === 'Buscar paciente'
  const esUsuarios = title === 'Usuarios'

  // ─── Estado del modal de Usuarios ───
  const [usuario, setUsuario] = useState<FormUsuario>(USUARIO_VACIO)
  const [usuarioMensaje, setUsuarioMensaje] = useState('')
  const [guardandoUsuario, setGuardandoUsuario] = useState(false)

  const crearUsuario = async () => {
    setGuardandoUsuario(true)
    setUsuarioMensaje('')
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usuario),
    })
    const result = (await response.json()) as { error?: string; email?: string }
    setGuardandoUsuario(false)
    if (!response.ok) {
      setUsuarioMensaje(result.error ?? 'No se pudo crear el usuario.')
      return
    }
    setUsuarioMensaje(`Usuario creado: ${result.email}`)
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    setUsuario(USUARIO_VACIO)
  }

  // ─── Estado del buscador de pacientes ───
  const [pacientes, setPacientes] = useState<{ nombre: string; identificacion: string; pass: string; telefono: string; estado: string }[]>([])
  useEffect(() => {
    let vigente = true
    cargarPacientes().then((resultado) => {
      if (!vigente) return
      setPacientes(resultado.filas.map((fila) => ({
        nombre: fila[0] ?? '—',
        identificacion: fila[1] ?? '—',
        pass: '—',
        telefono: fila[2] ?? '—',
        estado: fila[4] ?? 'Activo',
      })))
    })
    return () => { vigente = false }
  }, [])

  const [value, setValue] = useState('')
  const [resultadoActivo, setResultadoActivo] = useState(0)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(false)

  const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const resultados = pacientes
    .filter((paciente) => normalizar(`${paciente.nombre} ${paciente.identificacion} ${paciente.telefono}`).includes(normalizar(value)))
    .slice(0, 6)

  const seleccionarPaciente = (nombre: string) => {
    setValue(nombre)
    setPacienteSeleccionado(true)
  }

  const manejarTeclado = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setResultadoActivo((actual) => Math.min(actual + 1, resultados.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setResultadoActivo((actual) => Math.max(actual - 1, 0))
    }
    if (event.key === 'Enter' && resultados[resultadoActivo]) {
      event.preventDefault()
      seleccionarPaciente(resultados[resultadoActivo].nombre)
    }
  }
  // ─── Estado de "Nueva cita" (todo viene de Supabase) ───
  const [medicos, setMedicos] = useState<MedicoAgenda[]>([])
  const [pacientesCita, setPacientesCita] = useState<{ id: number; nombre: string }[]>([])
  const [clinicaId, setClinicaId] = useState<number | null>(null)
  const [medicoId, setMedicoId] = useState<number | null>(null)
  const [pacienteId, setPacienteId] = useState<number | null>(null)
  const [disponibilidad, setDisponibilidad] = useState<DiaDisponible[]>([])
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [horarioSeleccionado, setHorarioSeleccionado] = useState('')
  const [citaError, setCitaError] = useState('')
  const [cargandoCita, setCargandoCita] = useState(false)
  const [cargandoAgenda, setCargandoAgenda] = useState(false)

  // Carga inicial: médicos, pacientes y clínica.
  useEffect(() => {
    if (!esNuevaCita) return
    let vigente = true
    setCargandoCita(true)
    Promise.all([cargarMedicosAgenda(), cargarPacientesParaCita(), cargarClinicaActiva()])
      .then(([medicosResult, pacientesResult, clinica]) => {
        if (!vigente) return
        setMedicos(medicosResult.filas)
        setPacientesCita(pacientesResult.filas)
        setClinicaId(clinica)
        setMedicoId((anterior) => anterior ?? medicosResult.filas[0]?.id ?? null)
        setCitaError(medicosResult.error ?? '')
        setCargandoCita(false)
      })
    return () => { vigente = false }
  }, [esNuevaCita])

  // Cada vez que cambia el médico, se recalcula su disponibilidad real.
  useEffect(() => {
    if (!esNuevaCita || medicoId === null) return
    let vigente = true
    setCargandoAgenda(true)
    setHorarioSeleccionado('')
    const medico = medicos.find((m) => m.id === medicoId)
    cargarDisponibilidad(medicoId, medico?.duracionConsulta ?? 20).then((resultado) => {
      if (!vigente) return
      setDisponibilidad(resultado.filas)
      setFechaSeleccionada(resultado.filas[0]?.fecha ?? '')
      setCitaError(resultado.error ?? '')
      setCargandoAgenda(false)
    })
    return () => { vigente = false }
  }, [esNuevaCita, medicoId, medicos])

  const medicoSeleccionado = medicos.find((m) => m.id === medicoId) ?? null
  const diaSeleccionado = disponibilidad.find((d) => d.fecha === fechaSeleccionada) ?? null
  const puedeGuardarCita =
    esNuevaCita && !cargandoCita && !cargandoAgenda &&
    pacienteId !== null && medicoId !== null && clinicaId !== null &&
    fechaSeleccionada !== '' && horarioSeleccionado !== ''

  async function confirmarCita() {
    if (!puedeGuardarCita || medicoId === null || clinicaId === null || pacienteId === null || !medicoSeleccionado) return
    setCargandoCita(true)
    setCitaError('')
    const resultado = await crearCita({
      pacienteId,
      medicoId,
      clinicaId,
      fecha: fechaSeleccionada,
      hora: horarioSeleccionado,
      motivo: value,
      duracionConsulta: medicoSeleccionado.duracionConsulta,
    })
    setCargandoCita(false)
    if (resultado.error) {
      setCitaError(resultado.error)
      return
    }
    // Refresca la disponibilidad para que el horario recién usado desaparezca.
    const frescos = await cargarDisponibilidad(medicoId, medicoSeleccionado.duracionConsulta)
    setDisponibilidad(frescos.filas)

    // Avisa al resto de la app para que vuelva a leer el módulo desde Supabase.
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    onSave(`Cita #${resultado.id} · ${medicoSeleccionado.nombre} · ${fechaSeleccionada} · ${horarioSeleccionado}`)
  }


const descripcion = esUsuarios
    ? 'Crea cuentas de acceso para el personal de la clínica.'
    : esBusqueda
      ? 'Busca por nombre, identificación o teléfono.'
      : esNuevaCita
        ? 'Ingresa los datos y revisa la disponibilidad antes de guardar.'
        : 'Completa la información para continuar con esta acción.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="modal-title" className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">{descripcion}</p>

        <div className="mt-5 flex flex-col gap-3">
          {esUsuarios && (
            <FormularioUsuario
              usuario={usuario}
              setUsuario={setUsuario}
              mensaje={usuarioMensaje}
              guardando={guardandoUsuario}
              onCrear={crearUsuario}
            />
          )}

          {esBusqueda && (
            <BuscadorPaciente
              value={value}
              onChange={(v) => {
                setValue(v)
                setPacienteSeleccionado(false)
                setResultadoActivo(0)
              }}
              resultados={resultados}
              resultadoActivo={resultadoActivo}
              seleccionado={pacienteSeleccionado}
              onTeclado={manejarTeclado}
              onSeleccionar={seleccionarPaciente}
            />
          )}

          {!esUsuarios && !esBusqueda && (
            <>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label="Nombre o descripción"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Nombre o descripción"
              />
              <textarea
                aria-label="Observaciones"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Observaciones"
                rows={3}
              />

              {esNuevaCita && (
                <SelectorCita
                  cargando={cargandoCita}
                  cargandoAgenda={cargandoAgenda}
                  medicos={medicos}
                  medicoId={medicoId}
                  onMedico={setMedicoId}
                  pacientes={pacientesCita}
                  pacienteId={pacienteId}
                  onPaciente={setPacienteId}
                  dias={disponibilidad}
                  diaActual={diaSeleccionado}
                  fecha={fechaSeleccionada}
                  onFecha={(f) => {
                    setFechaSeleccionada(f)
                    setHorarioSeleccionado('')
                  }}
                  horario={horarioSeleccionado}
                  onHorario={setHorarioSeleccionado}
                  error={citaError}
                />
              )}
            </>
          )}
        </div>

        {!esBusqueda && (
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={esNuevaCita ? confirmarCita : () => onSave(value)}
              disabled={esNuevaCita ? !puedeGuardarCita : false}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {esNuevaCita && cargandoCita && <Loader2 size={14} className="animate-spin" />}
              {esNuevaCita && cargandoCita ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}