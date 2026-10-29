'use client'

import { useState, type Dispatch, type SetStateAction, type FormEvent } from 'react'
import { CAMPO, ETIQUETA, ModalMarco } from '../../compartidos/modal-marco'
import { BotonCancelarUsuarios } from './cancelar-usuarios/boton-cancelar-usuarios'
import { BotonGuardarUsuarios } from './guardar-usuarios/boton-guardar-usuarios'

const USUARIO_VACIO = {
  nombre: '', email: '', password: '', rol: 'medico',
  especialidad: '', cedula: '', duracion: '20', fechaNacimiento: '', genero: '', telefono: '',
}

type FormUsuario = typeof USUARIO_VACIO

type PropsFormularioUsuario = {
  usuario: FormUsuario
  setUsuario: Dispatch<SetStateAction<FormUsuario>>
  error: string
  mensaje: string
  guardando: boolean
  onCrear: () => void
}

function FormularioUsuario({ usuario, setUsuario, error, mensaje, onCrear }: PropsFormularioUsuario) {
  const campo = <T extends keyof FormUsuario>(clave: T) => ({
    value: usuario[clave],
    onChange: (e: { target: { value: string } }) => setUsuario({ ...usuario, [clave]: e.target.value }),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onCrear()
  }

  return (
    <form id="form-crear-usuario" onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className={ETIQUETA}>
        Nombre
        <input {...campo('nombre')} required className={CAMPO} placeholder="Dra. Ana López" />
      </label>
      <label className={ETIQUETA}>
        Correo
        <input {...campo('email')} type="email" required className={CAMPO} placeholder="ana@clinicanova.com" />
      </label>
      <label className={ETIQUETA}>
        Contraseña
        <input {...campo('password')} type="password" required minLength={6} className={CAMPO} placeholder="Mínimo 6 caracteres" />
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
              <input {...campo('especialidad')} required className={`${CAMPO} bg-white`} placeholder="Cardiología" />
            </label>
            <label className={ETIQUETA}>
              Cédula profesional
              <input {...campo('cedula')} required className={`${CAMPO} bg-white`} placeholder="CED-0042" />
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

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>
      )}

      {mensaje && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{mensaje}</p>
      )}
    </form>
  )
}

export function ModalUsuarios({
  onClose,
  onSave,
  rolInicial,
}: {
  onClose: () => void
  onSave: (value: string) => void
  rolInicial?: string
}) {
  const [usuario, setUsuario] = useState<FormUsuario>(() => ({
    ...USUARIO_VACIO,
    rol: rolInicial ?? 'medico',
  }))
  const [usuarioMensaje, setUsuarioMensaje] = useState('')
  const [usuarioError, setUsuarioError] = useState('')
  const [guardandoUsuario, setGuardandoUsuario] = useState(false)

  const crearUsuario = async () => {
    setGuardandoUsuario(true)
    setUsuarioMensaje('')
    setUsuarioError('')

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usuario),
      })
      const result = (await response.json()) as { error?: string; email?: string }

      if (!response.ok) {
        setUsuarioError(result.error ?? 'No se pudo crear el usuario.')
        return
      }

      window.dispatchEvent(new CustomEvent('datos-actualizados'))
      onSave(result.email ?? usuario.email)
    } catch {
      setUsuarioError('Ocurrió un error inesperado al conectar con el servidor.')
    } finally {
      setGuardandoUsuario(false)
    }
  }

  return (
    <ModalMarco
      title="Usuarios"
      onClose={onClose}
      footer={
        <div className="mt-6 flex justify-end gap-2">
          <BotonCancelarUsuarios deshabilitado={guardandoUsuario} onCancelar={onClose} />
          <BotonGuardarUsuarios guardando={guardandoUsuario} onGuardar={crearUsuario} />
        </div>
      }
    >
      <FormularioUsuario
        usuario={usuario}
        setUsuario={setUsuario}
        error={usuarioError}
        mensaje={usuarioMensaje}
        guardando={guardandoUsuario}
        onCrear={crearUsuario}
      />
    </ModalMarco>
  )
}

