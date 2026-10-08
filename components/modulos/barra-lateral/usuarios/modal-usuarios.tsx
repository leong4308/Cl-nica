'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { CAMPO, ETIQUETA, ModalMarco } from '../../compartidos/modal-marco'
import { BotonCancelarUsuarios } from './cancelar-usuarios/boton-cancelar-usuarios'
import { BotonGuardarUsuarios } from './guardar-usuarios/boton-guardar-usuarios'
import { BotonCrearUsuario } from './crear-usuario/boton-crear-usuario'

/**
 * Modal de Usuarios: alta de cuentas de acceso desde la barra lateral.
 *
 * NO es una de las 4 acciones rápidas del dashboard, por eso vive en
 * `compartidos/` y no en `acciones-rapidas/`.
 *
 * Nota de comportamiento heredado: el pie "Guardar" de este modal solo cierra
 * (llama a `onSave('')`). La escritura real la hace el botón "Crear usuario"
 * de `FormularioUsuario`, que corre contra `/api/admin/users`.
 */

const USUARIO_VACIO = {
  nombre: '', email: '', password: '', rol: 'medico',
  especialidad: '', cedula: '', duracion: '20', fechaNacimiento: '', genero: '', telefono: '',
}

type FormUsuario = typeof USUARIO_VACIO

type PropsFormularioUsuario = {
  usuario: FormUsuario
  setUsuario: Dispatch<SetStateAction<FormUsuario>>
  mensaje: string
  guardando: boolean
  onCrear: () => void
}

function FormularioUsuario({ usuario, setUsuario, mensaje, guardando, onCrear }: PropsFormularioUsuario) {
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

      <BotonCrearUsuario guardando={guardando} onCrear={onCrear} />
    </>
  )
}

export function ModalUsuarios({ onClose, onSave }: { onClose: () => void; onSave: (value: string) => void }) {
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

  return (
    <ModalMarco
      title="Usuarios"
      onClose={onClose}
      footer={
        <div className="mt-6 flex justify-end gap-2">
          <BotonCancelarUsuarios deshabilitado={guardandoUsuario} onCancelar={onClose} />
          <BotonGuardarUsuarios onGuardar={() => onSave('')} />
        </div>
      }
    >
      <FormularioUsuario
        usuario={usuario}
        setUsuario={setUsuario}
        mensaje={usuarioMensaje}
        guardando={guardandoUsuario}
        onCrear={crearUsuario}
      />
    </ModalMarco>
  )
}
