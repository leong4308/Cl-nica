'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Stethoscope,
  HeartHandshake,
  UserCheck,
  UserX,
  Mail,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Filter,
} from 'lucide-react'

type UsuarioSistema = {
  id: number
  auth_user_id: string | null
  correo: string
  nombre_completo: string
  telefono: string | null
  rol: 'admin' | 'medico' | 'enfermero' | 'recepcionista' | 'paciente'
  esta_activo: boolean
  creado_en: string
  perfiles_medicos?: { id: number; especialidad: string; cedula_profesional: string; duracion_consulta: number; esta_activo: boolean }[] | null
  perfiles_enfermeros?: { id: number; especialidad: string | null; esta_activo: boolean }[] | null
}

const USUARIO_VACIO = {
  nombre: '',
  email: '',
  password: '',
  rol: 'medico',
  especialidad: '',
  cedula: '',
  duracion: '20',
  telefono: '',
}

export function ModalUsuarios({ onClose, onSave }: { onClose: () => void; onSave: (value: string) => void }) {
  const [pestana, setPestana] = useState<'lista' | 'crear'>('lista')
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<string>('todos')

  const [form, setForm] = useState(USUARIO_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [mensajeForm, setMensajeForm] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [actualizandoId, setActualizandoId] = useState<number | null>(null)

  const cargarUsuarios = async () => {
    setCargando(true)
    setErrorCarga('')
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) {
        setErrorCarga(data.error ?? 'No se pudieron cargar los usuarios')
      } else {
        setUsuarios(data.usuarios ?? [])
      }
    } catch {
      setErrorCarga('Error de conexión al cargar usuarios')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const coincideBusqueda =
        u.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.correo.toLowerCase().includes(busqueda.toLowerCase())
      const coincideRol = filtroRol === 'todos' || u.rol === filtroRol
      return coincideBusqueda && coincideRol
    })
  }, [usuarios, busqueda, filtroRol])

  const toggleEstadoUsuario = async (usr: UsuarioSistema) => {
    setActualizandoId(usr.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: usr.id, esta_activo: !usr.esta_activo }),
      })
      if (res.ok) {
        setUsuarios((prev) =>
          prev.map((item) => (item.id === usr.id ? { ...item, esta_activo: !usr.esta_activo } : item))
        )
        window.dispatchEvent(new CustomEvent('datos-actualizados'))
      }
    } finally {
      setActualizandoId(null)
    }
  }

  const crearUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensajeForm(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensajeForm({ tipo: 'error', texto: data.error ?? 'Error al registrar usuario.' })
      } else {
        setMensajeForm({ tipo: 'exito', texto: 'Usuario registrado con éxito.' })
        setForm(USUARIO_VACIO)
        window.dispatchEvent(new CustomEvent('datos-actualizados'))
        await cargarUsuarios()
        setTimeout(() => {
          setPestana('lista')
          setMensajeForm(null)
        }, 1200)
      }
    } catch {
      setMensajeForm({ tipo: 'error', texto: 'Ocurrió un error inesperado de red.' })
    } finally {
      setGuardando(false)
    }
  }

  const badgesRol: Record<string, { label: string; bg: string; text: string; icon: typeof Users }> = {
    admin: { label: 'Administrador', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', icon: Shield },
    medico: { label: 'Médico', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: Stethoscope },
    enfermero: { label: 'Enfermero', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: HeartHandshake },
    recepcionista: { label: 'Recepción', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Users },
    paciente: { label: 'Paciente', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', icon: UserCheck },
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-sm transition-all"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="flex h-[94vh] max-h-[820px] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Users className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Gestión de Usuarios</h2>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {usuarios.length} cuentas
                </span>
              </div>
              <p className="text-xs text-slate-500">Administra roles, accesos y personal del sistema</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPestana('lista')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  pestana === 'lista'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="size-3.5" />
                <span>Personal</span>
              </button>
              <button
                type="button"
                onClick={() => setPestana('crear')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  pestana === 'crear'
                    ? 'bg-white text-blue-700 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="size-3.5" />
                <span>Nuevo usuario</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {pestana === 'lista' ? (
          <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/40">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 bg-white p-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o correo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <Filter className="size-4 text-slate-400 shrink-0 hidden sm:block" />
                <select
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="todos">Todos los roles</option>
                  <option value="admin">Administradores</option>
                  <option value="medico">Médicos</option>
                  <option value="enfermero">Enfermeros</option>
                  <option value="recepcionista">Recepcionistas</option>
                  <option value="paciente">Pacientes</option>
                </select>
                <button
                  type="button"
                  onClick={() => setPestana('crear')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors shrink-0"
                >
                  <UserPlus className="size-3.5" />
                  <span>Crear</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              {cargando ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="size-8 animate-spin text-blue-600 mb-2" />
                  <p className="text-sm">Cargando directorio de personal...</p>
                </div>
              ) : errorCarga ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                  <AlertCircle className="mx-auto size-6 mb-1 text-red-500" />
                  {errorCarga}
                </div>
              ) : usuariosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <Users className="size-12 stroke-1 mb-2 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No se encontraron usuarios</p>
                  <p className="text-xs text-slate-400 mt-0.5">Prueba ajustando el término de búsqueda o el rol seleccionado.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                  {usuariosFiltrados.map((usr) => {
                    const rolCfg = badgesRol[usr.rol] || badgesRol.paciente
                    const RolIcon = rolCfg.icon
                    const med = usr.perfiles_medicos?.[0]
                    const enf = usr.perfiles_enfermeros?.[0]

                    return (
                      <div
                        key={usr.id}
                        className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                {usr.nombre_completo.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-sm text-slate-900 truncate">{usr.nombre_completo}</h4>
                                <p className="flex items-center gap-1 text-xs text-slate-500 truncate">
                                  <Mail className="size-3 shrink-0 text-slate-400" />
                                  <span className="truncate">{usr.correo}</span>
                                </p>
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold shrink-0 ${rolCfg.bg} ${rolCfg.text}`}
                            >
                              <RolIcon className="size-3" />
                              <span>{rolCfg.label}</span>
                            </span>
                          </div>

                          {(med || enf) && (
                            <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 space-y-0.5">
                              {med && (
                                <>
                                  <p className="font-semibold text-slate-800">Especialidad: {med.especialidad}</p>
                                  <p className="text-[11px] text-slate-500">Cédula: {med.cedula_profesional} · Consulta: {med.duracion_consulta} min</p>
                                </>
                              )}
                              {enf && (
                                <p className="font-semibold text-slate-800">Especialidad: {enf.especialidad || 'General'}</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`size-2 rounded-full ${
                                usr.esta_activo ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            />
                            <span className={usr.esta_activo ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                              {usr.esta_activo ? 'Activo' : 'Desactivado'}
                            </span>
                          </div>

                          {usr.rol !== 'admin' && (
                            <button
                              type="button"
                              disabled={actualizandoId === usr.id}
                              onClick={() => toggleEstadoUsuario(usr)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                                usr.esta_activo
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {actualizandoId === usr.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : usr.esta_activo ? (
                                <>
                                  <UserX className="size-3" />
                                  <span>Desactivar</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="size-3" />
                                  <span>Reactivar</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/30">
            <div className="mx-auto max-w-xl rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm">
              <div className="mb-6 flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Registrar nuevo colaborador</h3>
                  <p className="text-xs text-slate-500">Crea credenciales y asigna perfil médico o administrativo</p>
                </div>
              </div>

              {mensajeForm && (
                <div
                  className={`mb-5 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${
                    mensajeForm.tipo === 'exito'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {mensajeForm.tipo === 'exito' ? (
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{mensajeForm.texto}</span>
                </div>
              )}

              <form onSubmit={crearUsuario} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre completo</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej. Dra. Laura Ruiz"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Correo electrónico</label>
                    <input
                      required
                      type="email"
                      placeholder="usuario@clinicanova.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña</label>
                    <input
                      required
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Rol en el sistema</label>
                    <select
                      value={form.rol}
                      onChange={(e) => setForm({ ...form, rol: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white font-medium"
                    >
                      <option value="medico">Médico especialista</option>
                      <option value="enfermero">Enfermero / Personal de enfermería</option>
                      <option value="recepcionista">Recepcionista</option>
                      <option value="admin">Administrador del sistema</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Nota: Los pacientes tienen su propio registro en el módulo de Pacientes.
                    </p>
                  </div>
                </div>

                {form.rol === 'medico' && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-blue-800 font-semibold text-xs">
                      <Stethoscope className="size-4" />
                      <span>Ficha médica profesional</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Especialidad</label>
                        <input
                          required
                          type="text"
                          placeholder="Ej. Cardiología"
                          value={form.especialidad}
                          onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Cédula profesional</label>
                        <input
                          required
                          type="text"
                          placeholder="Ej. CED-0042"
                          value={form.cedula}
                          onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Duración de consulta (minutos)</label>
                        <input
                          type="number"
                          min="5"
                          max="120"
                          value={form.duracion}
                          onChange={(e) => setForm({ ...form, duracion: e.target.value })}
                          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {form.rol === 'enfermero' && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-semibold text-xs">
                      <HeartHandshake className="size-4" />
                      <span>Ficha de enfermería</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Área o especialidad (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej. Cuidados intensivos, Pediatría..."
                        value={form.especialidad}
                        onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                        className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPestana('lista')}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Volver a lista
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    {guardando ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Creando cuenta...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5" />
                        <span>Registrar usuario</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
