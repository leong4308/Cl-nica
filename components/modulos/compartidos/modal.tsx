import { useEffect, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
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
import { actualizarAgendaEnCache, leerCacheCita } from '@/lib/supabase/cache-cita'
import { guardarModulo, leerModulo } from '@/lib/supabase/cache-modulos'
import {
  BuscadorPaciente,
  BuscadorPacienteCita,
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
  // Los pacientes vienen precargados con los módulos, así que el buscador abre
  // con resultados ya disponibles.
  const pacientesIniciales = leerModulo('Pacientes')
  const [pacientes, setPacientes] = useState<{ nombre: string; identificacion: string; pass: string; telefono: string; estado: string }[]>(
    () => (pacientesIniciales?.filas ?? []).map((fila) => ({
      nombre: fila[0] ?? '—',
      identificacion: fila[1] ?? '—',
      pass: '—',
      telefono: fila[2] ?? '—',
      estado: fila[4] ?? 'Activo',
    })),
  )
  useEffect(() => {
    let vigente = true
    cargarPacientes().then((resultado) => {
      if (!vigente || resultado.error) return
      setPacientes(resultado.filas.map((fila) => ({
        nombre: fila[0] ?? '—',
        identificacion: fila[1] ?? '—',
        pass: '—',
        telefono: fila[2] ?? '—',
        estado: fila[4] ?? 'Activo',
      })))
      guardarModulo('Pacientes', resultado.filas, resultado.error)
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
  // La caché se lee de forma síncrona durante el render: si los datos ya
  // estaban precargados al entrar a la app, el modal aparece completo de una.
  const cacheInicial = leerCacheCita()
  const medicoInicial = cacheInicial?.medicos[0]?.id ?? null
  const agendaInicial =
    medicoInicial !== null ? cacheInicial?.agendas[medicoInicial] : undefined

  const [medicos, setMedicos] = useState<MedicoAgenda[]>(cacheInicial?.medicos ?? [])
  const [pacientesCita, setPacientesCita] = useState<{ id: number; nombre: string }[]>(cacheInicial?.pacientes ?? [])
  const [clinicaId, setClinicaId] = useState<number | null>(cacheInicial?.clinicaId ?? null)
  const [medicoId, setMedicoId] = useState<number | null>(medicoInicial)
  const [pacienteId, setPacienteId] = useState<number | null>(null)
  const [disponibilidad, setDisponibilidad] = useState<DiaDisponible[]>(agendaInicial?.filas ?? [])
  const [fechaSeleccionada, setFechaSeleccionada] = useState(agendaInicial?.filas[0]?.fecha ?? '')
  const [horarioSeleccionado, setHorarioSeleccionado] = useState('')
  const [citaError, setCitaError] = useState('')
  const [cargandoCita, setCargandoCita] = useState(!cacheInicial)
  const [cargandoAgenda, setCargandoAgenda] = useState(false)
  // Con la caché llena el modal se dibuja desde el primer render; sin ella
  // espera a que termine la carga, para no aparecer a medias.
  const [citaLista, setCitaLista] = useState(cacheInicial !== null)

  // Carga inicial: médicos, pacientes y clínica. Solo si no Vinieron en caché.
  useEffect(() => {
    if (!esNuevaCita || cacheInicial) return
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
        // Sin médicos no hay agenda que cargar: liberamos el modal para que sí
        // aparezca y muestre el aviso de que no hay médicos registrados.
        if (medicosResult.filas.length === 0) setCitaLista(true)
      })
    return () => { vigente = false }
  }, [esNuevaCita, cacheInicial])

  /** Cambia de médico usando la caché si la tiene; si no, la pide a Supabase. */
  const cambiarMedico = (nuevoId: number) => {
    setMedicoId(nuevoId)
    setHorarioSeleccionado('')

    const guardada = leerCacheCita()?.agendas[nuevoId]
    if (guardada) {
      setDisponibilidad(guardada.filas)
      setFechaSeleccionada(guardada.filas[0]?.fecha ?? '')
      setCitaError(guardada.error ?? '')
      setCargandoAgenda(false)
      setCitaLista(true)
      return
    }

    const medico = medicos.find((m) => m.id === nuevoId)
    setCargandoAgenda(true)
    cargarDisponibilidad(nuevoId, medico?.duracionConsulta ?? 20).then((resultado) => {
      setDisponibilidad(resultado.filas)
      setFechaSeleccionada(resultado.filas[0]?.fecha ?? '')
      setCitaError(resultado.error ?? '')
      setCargandoAgenda(false)
      setCitaLista(true)
    })
  }

  // Agenda inicial cuando no había caché (el resto ya lo resuelve `cambiarMedico`).
  useEffect(() => {
    if (!esNuevaCita || medicoId === null) return
    if (leerCacheCita()?.agendas[medicoId]) return
    let vigente = true
    setCargandoAgenda(true)
    const medico = medicos.find((m) => m.id === medicoId)
    cargarDisponibilidad(medicoId, medico?.duracionConsulta ?? 20).then((resultado) => {
      if (!vigente) return
      setDisponibilidad(resultado.filas)
      setFechaSeleccionada(resultado.filas[0]?.fecha ?? '')
      setCitaError(resultado.error ?? '')
      setCargandoAgenda(false)
      setCitaLista(true)
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
      motivo: 'Consulta general',
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
    // Se guarda en caché para que al reabrir el modal ese horario ya figure ocupado.
    actualizarAgendaEnCache(medicoId, frescos.filas, frescos.error)

    // Avisa al resto de la app para que vuelva a leer el módulo desde Supabase.
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    onSave(`Cita #${resultado.id} · ${medicoSeleccionado.nombre} · ${fechaSeleccionada} · ${horarioSeleccionado}`)
  }


  // Guard defensivo: se coloca DESPUÉS de todos los hooks para no romper las
  // Rules of Hooks. `openModal` ya filtra, pero así el modal nunca se dibuja vacío.
  if (!esNuevaCita && !esBusqueda && !esUsuarios) return null

  // "Nueva cita" no se dibuja hasta tener médicos, pacientes y agenda: así
  // aparece de una sola vez ya completo, sin parpadear estados intermedios.
  if (esNuevaCita && !citaLista) return null

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

          {esNuevaCita && !cargandoCita && (
            <BuscadorPacienteCita
              pacientes={pacientesCita}
              seleccionadoId={pacienteId}
              onSeleccionar={(id) => setPacienteId(id === 0 ? null : id)}
            />
          )}

          {esNuevaCita && !cargandoCita && (
            <SelectorCita
              cargando={cargandoCita}
              cargandoAgenda={cargandoAgenda}
              medicos={medicos}
              medicoId={medicoId}
              onMedico={cambiarMedico}
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}