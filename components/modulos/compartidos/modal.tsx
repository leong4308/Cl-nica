'use client'

import { useState, useEffect, type KeyboardEvent } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { obtenerListaPacientes, obtenerListaMedicos, type PacienteOption, type MedicoOption } from '@/lib/consultas'
import { crearCita, crearPaciente, crearMedico, crearOrdenMedica } from '@/lib/acciones'

export function ClinicModal({
  title,
  onClose,
  onSave,
}: {
  title: string
  onClose: () => void
  onSave: (value: string) => void
}) {
  const esNuevaCita = title === 'Nueva cita'
  const esBusqueda = title === 'Buscar paciente'
  const esUsuarios = title === 'Usuarios'
  const esNuevoPaciente = title === 'Nuevo paciente' || title === 'Registrar paciente'
  const esRegistrarMedico = title === 'Registrar médico'
  const esNuevaOrden = title === 'Nueva orden'

  // Estado para gestión de usuarios administrativos
  const [usuario, setUsuario] = useState({ nombre: '', email: '', password: '', rol: 'medico' })
  const [usuarioMensaje, setUsuarioMensaje] = useState('')
  const [guardandoUsuario, setGuardandoUsuario] = useState(false)

  // Estado para Nuevo Paciente
  const [pacienteForm, setPacienteForm] = useState({
    nombre: '',
    telefono: '',
    correo: '',
    fechaNacimiento: '',
    genero: 'F',
    notas: '',
  })

  // Estado para Registrar Médico
  const [medicoForm, setMedicoForm] = useState({
    nombre: '',
    especialidad: 'Medicina general',
    cedula: '',
    telefono: '',
    correo: '',
  })

  // Estado para Nueva Orden
  const [ordenForm, setOrdenForm] = useState({
    tipo: 'analisis' as 'analisis' | 'medicamento' | 'tratamiento' | 'procedimiento',
    descripcion: '',
    instrucciones: '',
  })

  // Estado de carga y errores
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')

  // Lista dinámica de pacientes y médicos desde Supabase
  const [pacientes, setPacientes] = useState<PacienteOption[]>([])
  const [doctores, setDoctores] = useState<MedicoOption[]>([])
  const [cargandoDatos, setCargandoDatos] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargandoDatos(true)
      const [listaPacientes, listaMedicos] = await Promise.all([
        obtenerListaPacientes(),
        obtenerListaMedicos(),
      ])
      if (activo) {
        setPacientes(listaPacientes)
        setDoctores(listaMedicos)
        if (listaMedicos.length > 0 && !medico) {
          setMedico(listaMedicos[0].nombre)
        }
        setCargandoDatos(false)
      }
    }
    void cargar()
    return () => { activo = false }
  }, [])

  const crearUsuario = async () => {
    setGuardandoUsuario(true)
    setUsuarioMensaje('')
    try {
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
      setUsuarioMensaje(`Usuario creado correctamente: ${result.email}`)
      setUsuario({ nombre: '', email: '', password: '', rol: 'medico' })
    } catch {
      setGuardandoUsuario(false)
      setUsuarioMensaje('Error de red al conectar con el servidor.')
    }
  }

  // Búsqueda y selección de paciente
  const [value, setValue] = useState('')
  const [resultadoActivo, setResultadoActivo] = useState(0)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<PacienteOption | null>(null)

  const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const resultados = pacientes
    .filter((paciente) =>
      normalizar(`${paciente.nombre} ${paciente.identificacion} ${paciente.telefono}`).includes(
        normalizar(value),
      ),
    )
    .slice(0, 6)

  const seleccionarPaciente = (p: PacienteOption) => {
    setValue(p.nombre)
    setPacienteSeleccionado(p)
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
      seleccionarPaciente(resultados[resultadoActivo])
    }
  }

  const [medico, setMedico] = useState('')
  const [fechaCita, setFechaCita] = useState(() => {
    const hoy = new Date()
    return hoy.toISOString().split('T')[0]
  })
  const [horaCita, setHoraCita] = useState('09:00')
  const [motivoCita, setMotivoCita] = useState('Consulta general')

  // Guardado unificado a Supabase
  const manejarGuardar = async () => {
    setErrorGeneral('')
    setGuardando(true)

    try {
      if (esNuevaCita) {
        if (!pacienteSeleccionado && !value.trim()) {
          setErrorGeneral('Debes seleccionar o escribir el nombre de un paciente.')
          setGuardando(false)
          return
        }

        // Buscar paciente existente o crear uno rápido si no existe
        let idPaciente = pacienteSeleccionado?.id
        if (!idPaciente) {
          const match = pacientes.find((p) => normalizar(p.nombre) === normalizar(value.trim()))
          if (match) {
            idPaciente = match.id
          } else {
            const nuevo = await crearPaciente({ nombre_completo: value.trim() })
            idPaciente = nuevo.perfil.id
          }
        }

        const docEncontrado = doctores.find((d) => d.nombre === medico) || doctores[0]
        const idMedico = docEncontrado ? docEncontrado.id : 1
        const idClinica = docEncontrado ? docEncontrado.clinica_id : 1

        const inicioDate = new Date(`${fechaCita}T${horaCita}:00`)
        const finDate = new Date(inicioDate.getTime() + 30 * 60 * 1000)

        if (!idPaciente) {
          setErrorGeneral('No se pudo identificar o registrar al paciente.')
          setGuardando(false)
          return
        }

        await crearCita({
          paciente_id: idPaciente,
          medico_id: idMedico,
          clinica_id: idClinica,
          inicio: inicioDate.toISOString(),
          fin: finDate.toISOString(),
          motivo: motivoCita.trim() || 'Consulta médica',
        })

        onSave(`Cita para ${value} agendada para el ${fechaCita} a las ${horaCita}`)
        return
      }

      if (esNuevoPaciente) {
        if (!pacienteForm.nombre.trim()) {
          setErrorGeneral('El nombre del paciente es obligatorio.')
          setGuardando(false)
          return
        }

        await crearPaciente({
          nombre_completo: pacienteForm.nombre,
          telefono: pacienteForm.telefono,
          correo: pacienteForm.correo,
          fecha_nacimiento: pacienteForm.fechaNacimiento,
          genero: pacienteForm.genero,
          notas_medicas: pacienteForm.notas,
        })

        onSave(`Paciente ${pacienteForm.nombre} registrado en la base de datos`)
        return
      }

      if (esRegistrarMedico) {
        if (!medicoForm.nombre.trim() || !medicoForm.cedula.trim()) {
          setErrorGeneral('El nombre y la cédula profesional son obligatorios.')
          setGuardando(false)
          return
        }

        await crearMedico({
          nombre_completo: medicoForm.nombre,
          especialidad: medicoForm.especialidad,
          cedula_profesional: medicoForm.cedula,
          telefono: medicoForm.telefono,
          correo: medicoForm.correo,
        })

        onSave(`Médico ${medicoForm.nombre} registrado correctamente`)
        return
      }

      if (esNuevaOrden) {
        if (!ordenForm.descripcion.trim()) {
          setErrorGeneral('La descripción de la indicación es requerida.')
          setGuardando(false)
          return
        }

        await crearOrdenMedica({
          tipo_orden: ordenForm.tipo,
          descripcion: ordenForm.descripcion,
          instrucciones: ordenForm.instrucciones,
        })

        onSave(`Orden médica creada con éxito`)
        return
      }

      // Otras acciones genéricas
      onSave(value)
    } catch (err: unknown) {
      console.error('Error al guardar en Supabase:', err)
      const errorMsg = err instanceof Error ? err.message : 'Error inesperado al guardar en Supabase.'
      setErrorGeneral(errorMsg)
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="modal-title" className="text-lg font-bold">
            {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          {esUsuarios
            ? 'Crea cuentas de acceso para el personal de la clínica.'
            : esBusqueda
              ? 'Busca pacientes registrados en la base de datos de Supabase.'
              : esNuevaCita
                ? 'Agendará y guardará la cita médica directamente en Supabase.'
                : esNuevoPaciente
                  ? 'Registra un paciente en las tablas de usuarios y pacientes.'
                  : esRegistrarMedico
                    ? 'Añade un profesional médico al directorio activo.'
                    : 'Ingresa la información para continuar.'}
        </p>

        {errorGeneral && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorGeneral}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {/* VISTA 1: CREAR USUARIO EN AUTH */}
          {esUsuarios && (
            <>
              <label className="text-sm font-medium">
                Nombre
                <input
                  value={usuario.nombre}
                  onChange={(e) => setUsuario({ ...usuario, nombre: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Dra. Ana López"
                />
              </label>
              <label className="text-sm font-medium">
                Correo
                <input
                  type="email"
                  value={usuario.email}
                  onChange={(e) => setUsuario({ ...usuario, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="ana@clinicanova.com"
                />
              </label>
              <label className="text-sm font-medium">
                Contraseña
                <input
                  type="password"
                  value={usuario.password}
                  onChange={(e) => setUsuario({ ...usuario, password: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Mínimo 6 caracteres"
                />
              </label>
              <label className="text-sm font-medium">
                Rol
                <select
                  value={usuario.rol}
                  onChange={(e) => setUsuario({ ...usuario, rol: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="medico">Médico</option>
                  <option value="admin">Administrador</option>
                  <option value="recepcionista">Recepcionista</option>
                </select>
              </label>
              {usuarioMensaje && (
                <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-blue-700">
                  {usuarioMensaje}
                </p>
              )}
              <button
                type="button"
                onClick={crearUsuario}
                disabled={guardandoUsuario}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {guardandoUsuario ? <Loader2 size={16} className="animate-spin" /> : null}
                {guardandoUsuario ? 'Creando...' : 'Crear usuario en Supabase'}
              </button>
            </>
          )}

          {/* VISTA 2: BUSCADOR DE PACIENTES */}
          {esBusqueda && (
            <>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    setPacienteSeleccionado(null)
                    setResultadoActivo(0)
                  }}
                  onKeyDown={manejarTeclado}
                  aria-label="Buscar paciente"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Buscar por nombre o teléfono..."
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                {resultados.length > 0 ? (
                  resultados.map((paciente, indice) => (
                    <button
                      type="button"
                      key={paciente.id}
                      onClick={() => seleccionarPaciente(paciente)}
                      className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-3 text-left last:border-0 ${
                        indice === resultadoActivo ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{paciente.nombre}</span>
                        <span className="block text-xs text-slate-500">{paciente.identificacion} · {paciente.telefono}</span>
                      </span>
                      <span className={`text-[10px] font-semibold ${paciente.estado === 'Activo' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {paciente.estado}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-slate-400">
                    No encontramos pacientes con esa búsqueda.
                  </p>
                )}
              </div>
            </>
          )}

          {/* VISTA 3: NUEVA CITA CON CONEXIÓN DIRECTA */}
          {esNuevaCita && (
            <>
              <div className="relative">
                <label className="text-xs font-semibold text-slate-600">Paciente</label>
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    setPacienteSeleccionado(null)
                    setResultadoActivo(0)
                  }}
                  onKeyDown={manejarTeclado}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Escribe el nombre o busca un paciente..."
                />
                {value.trim() && !pacienteSeleccionado && resultados.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {resultados.map((paciente, indice) => (
                      <button
                        type="button"
                        key={paciente.id}
                        onClick={() => seleccionarPaciente(paciente)}
                        className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left last:border-0 ${
                          indice === resultadoActivo ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs font-semibold text-slate-800">{paciente.nombre}</span>
                        <span className="text-[10px] text-slate-400">{paciente.identificacion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600">
                  Fecha de la cita
                  <input
                    type="date"
                    value={fechaCita}
                    onChange={(e) => setFechaCita(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Hora de inicio
                  <input
                    type="time"
                    value={horaCita}
                    onChange={(e) => setHoraCita(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="text-xs font-semibold text-slate-600">
                Médico asignado
                <select
                  value={medico}
                  onChange={(e) => setMedico(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {doctores.map((doctor) => (
                    <option key={doctor.id} value={doctor.nombre}>
                      {doctor.nombre} · {doctor.especialidad}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-600">
                Motivo de la consulta
                <input
                  value={motivoCita}
                  onChange={(e) => setMotivoCita(e.target.value)}
                  placeholder="Ej. Control de presión, dolor de cabeza..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}

          {/* VISTA 4: REGISTRAR NUEVO PACIENTE */}
          {esNuevoPaciente && (
            <>
              <label className="text-xs font-semibold text-slate-600">
                Nombre completo *
                <input
                  required
                  value={pacienteForm.nombre}
                  onChange={(e) => setPacienteForm({ ...pacienteForm, nombre: e.target.value })}
                  placeholder="Nombre y apellidos"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600">
                  Teléfono
                  <input
                    value={pacienteForm.telefono}
                    onChange={(e) => setPacienteForm({ ...pacienteForm, telefono: e.target.value })}
                    placeholder="961-000-0000"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Correo electrónico
                  <input
                    type="email"
                    value={pacienteForm.correo}
                    onChange={(e) => setPacienteForm({ ...pacienteForm, correo: e.target.value })}
                    placeholder="paciente@ejemplo.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600">
                  Fecha de nacimiento
                  <input
                    type="date"
                    value={pacienteForm.fechaNacimiento}
                    onChange={(e) => setPacienteForm({ ...pacienteForm, fechaNacimiento: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Género
                  <select
                    value={pacienteForm.genero}
                    onChange={(e) => setPacienteForm({ ...pacienteForm, genero: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                    <option value="O">Otro</option>
                  </select>
                </label>
              </div>
              <label className="text-xs font-semibold text-slate-600">
                Alergias o notas médicas
                <textarea
                  value={pacienteForm.notas}
                  onChange={(e) => setPacienteForm({ ...pacienteForm, notas: e.target.value })}
                  placeholder="Alergias, medicamentos de uso continuo..."
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}

          {/* VISTA 5: REGISTRAR MÉDICO */}
          {esRegistrarMedico && (
            <>
              <label className="text-xs font-semibold text-slate-600">
                Nombre completo *
                <input
                  value={medicoForm.nombre}
                  onChange={(e) => setMedicoForm({ ...medicoForm, nombre: e.target.value })}
                  placeholder="Dr. Roberto Pérez"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600">
                  Especialidad
                  <input
                    value={medicoForm.especialidad}
                    onChange={(e) => setMedicoForm({ ...medicoForm, especialidad: e.target.value })}
                    placeholder="Pediatría, Cardiología..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Cédula profesional *
                  <input
                    value={medicoForm.cedula}
                    onChange={(e) => setMedicoForm({ ...medicoForm, cedula: e.target.value })}
                    placeholder="CED-000000"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600">
                  Teléfono
                  <input
                    value={medicoForm.telefono}
                    onChange={(e) => setMedicoForm({ ...medicoForm, telefono: e.target.value })}
                    placeholder="961-000-0000"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Correo electrónico
                  <input
                    type="email"
                    value={medicoForm.correo}
                    onChange={(e) => setMedicoForm({ ...medicoForm, correo: e.target.value })}
                    placeholder="doctor@clinicanova.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </>
          )}

          {/* VISTA 6: NUEVA ORDEN */}
          {esNuevaOrden && (
            <>
              <label className="text-xs font-semibold text-slate-600">
                Tipo de orden
                <select
                  value={ordenForm.tipo}
                  onChange={(e) => setOrdenForm({ ...ordenForm, tipo: e.target.value as any })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="analisis">Análisis clínico / Laboratorio</option>
                  <option value="medicamento">Medicamento</option>
                  <option value="tratamiento">Tratamiento</option>
                  <option value="procedimiento">Procedimiento / Imagen</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Descripción del estudio o indicación *
                <input
                  value={ordenForm.descripcion}
                  onChange={(e) => setOrdenForm({ ...ordenForm, descripcion: e.target.value })}
                  placeholder="Ej. Electrocardiograma, Química sanguínea..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Instrucciones
                <textarea
                  value={ordenForm.instrucciones}
                  onChange={(e) => setOrdenForm({ ...ordenForm, instrucciones: e.target.value })}
                  placeholder="Ayuno de 8 horas, indicaciones de toma..."
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}

          {/* VISTA 7: GENÉRICA */}
          {!esUsuarios && !esBusqueda && !esNuevaCita && !esNuevoPaciente && !esRegistrarMedico && !esNuevaOrden && (
            <>
              <input
                autoFocus
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
            </>
          )}
        </div>

        {!esBusqueda && !esUsuarios && (
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={manejarGuardar}
              disabled={guardando}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : null}
              {guardando ? 'Guardando en Supabase...' : 'Guardar en BD'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
