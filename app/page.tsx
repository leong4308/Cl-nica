'use client'

import { useEffect, useState } from 'react'
import { Dashboard } from '@/components/modulos/resumen/dashboard'
import { ModulePage } from '@/components/modulos/citas/module-page'
import { MedicosPage } from '@/components/modulos/medicos'
import { BarraLateral } from '@/components/modulos/barra-lateral'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { BotonCerrarAviso, BotonCerrarMenu } from './botones-pagina'
import { cargarPerfilSesion, cerrarSesion, type PerfilSesion } from '@/lib/supabase/sesion'
import { type RolUsuario } from '@/lib/supabase/tipos-rol'
import { obtenerItemDefaultPorRol } from '@/components/modulos/barra-lateral/navegacion/items-menu'
import { ModalUsuarios } from '@/components/modulos/barra-lateral/usuarios'
import { ModalBuscarPaciente } from '@/components/modulos/resumen/acciones-rapidas/buscar-paciente'
import { ModalNuevaCita } from '@/components/modulos/resumen/acciones-rapidas/nueva-cita'
import { ModalRegistrarPaciente } from '@/components/modulos/resumen/acciones-rapidas/registrar-paciente'
import { ModalResultadosPendientes } from '@/components/modulos/resumen/acciones-rapidas/ver-resultados-pendientes/modal-resultados-pendientes'
import { ModalAccionCita, type AccionCita } from '@/components/modulos/resumen/proximas-citas/modal-accion-cita'
import { LoginForm } from '@/components/login/login-form'
import {
  actualizarEstadoCita,
  eliminarCita,
  type CitaPanel,
  type EstadoCita,
} from '@/lib/supabase/datos'
import { ModalDetalleCita, ModalEditarCita } from '@/components/modulos/citas'
import { ModalPerfilPaciente } from '@/components/modulos/pacientes'
import { ModalConfirmarEliminacion } from '@/components/modulos/citas/confirmar-eliminacion/modal-confirmar-eliminacion'
import { precargarCita } from '@/lib/supabase/cache-cita'
import { precargarModulos } from '@/lib/supabase/cache-modulos'
import { InterfazRecepcionista } from '@/components/roles/recepcionista'
import { InterfazEnfermero } from '@/components/roles/enfermero'

type CitaEnEdicion = { cita: CitaPanel; accion: AccionCita } | null

export default function Page() {
  const [authenticated, setAuthenticated] = useState(false)
  const [active, setActive] = useState('Resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [citaAbierta, setCitaAbierta] = useState<CitaEnEdicion>(null)
  const [notice, setNotice] = useState('')
  const [perfil, setPerfil] = useState<PerfilSesion>({ nombre: 'Usuario', rol: 'paciente' })

  // Cuando cambia el rol, navegar al item por default de ese rol
  useEffect(() => {
    if (authenticated) {
      setActive(obtenerItemDefaultPorRol(perfil.rol))
    }
  }, [perfil.rol, authenticated])

  useEffect(() => {
    if (!authenticated) return
    precargarModulos()
    precargarCita()
    const refrescar = () => { precargarModulos(); precargarCita() }
    window.addEventListener('datos-actualizados', refrescar)
    return () => window.removeEventListener('datos-actualizados', refrescar)
  }, [authenticated])

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

const MODALES_CON_FORMULARIO = ['Usuarios', 'Buscar paciente', 'Nueva cita', 'Registrar paciente', 'Nuevo paciente', 'Ver resultados pendientes']
const MODALES_ACCIONES_CITA = ['Detalle', 'Editar', 'Eliminar', 'HistorialDetalle', 'PacienteDetalle']

const openModal = (title: string) => {
  const esAccionCita = MODALES_ACCIONES_CITA.some((prefijo) => title.startsWith(prefijo))
  if (MODALES_CON_FORMULARIO.includes(title) || esAccionCita) {
    setModal(title)
  }
}
  const navigate = (label: string) => { setActive(label); setMenuOpen(false); setModal(null) }

  const aplicarEstado = async (cita: CitaPanel, estado: EstadoCita, mensaje: string) => {
    const { error } = await actualizarEstadoCita(cita.id, estado)
    if (error) { notify(`No se pudo actualizar: ${error}`); return error }
    notify(mensaje)
    return null
  }

  const onEliminarCita = async (citaId: number) => {
    const { error } = await eliminarCita(citaId)
    if (error) {
      notify(`No se pudo eliminar: ${error}`)
      return error
    }
    notify(`Cita eliminada correctamente`)
    return null
  }

  const accionesCita = {
    onConfirmar: (cita: CitaPanel) => aplicarEstado(cita, 'confirmada', `Cita de ${cita.paciente} confirmada`),
    onRegistrar: (cita: CitaPanel) => aplicarEstado(cita, 'atendida', `Asistencia registrada para ${cita.paciente}`),
    onNoAsistio: (cita: CitaPanel) => aplicarEstado(cita, 'no_asistio', `${cita.paciente} quedó como no asistió`),
    onCancelar: (cita: CitaPanel) => aplicarEstado(cita, 'cancelada_paciente', `Cita de ${cita.paciente} cancelada`),
    onEliminar: (cita: CitaPanel) => onEliminarCita(cita.id),
  }

  const actions = {
    notify,
    openModal,
    navigate,
    addAppointment: (appointment: string[]) => window.dispatchEvent(new CustomEvent('cita-creada', { detail: appointment })),
    onAccion: (cita: CitaPanel, accion: AccionCita) => setCitaAbierta({ cita, accion }),
    rol: perfil.rol,
    usuarioNombre: perfil.nombre,
  }

  if (!authenticated) {
    return (
      <LoginForm
        onSuccess={async (perfilDirecto) => {
          if (perfilDirecto) {
            setPerfil(perfilDirecto)
          } else {
            setPerfil(await cargarPerfilSesion())
          }
          setAuthenticated(true)
        }}
      />
    )
  }

  /**
   * Renderizar contenido según el rol y pestaña activa:
   * - Admin: ve Dashboard global + todos los módulos
   * - Recepcionista: ve Dashboard + Citas, Pacientes, Médicos (directorio), Expedientes
   * - Médico: ve "Mi Consulta" (su estación) como pantalla principal + solo sus citas/pacientes/expedientes
   * - Enfermero: ve Dashboard + Citas, Pacientes, Internación, Órdenes
   */
  const renderContenido = () => {
    // "Mi Consulta" para médicos — va directo a su estación de consulta, fijado a su perfil
    if (active === 'Mi Consulta') {
      return <MedicosPage {...actions} usuario={perfil} />
    }

    // "Médicos" — solo para admin/recepcionista (directorio de todos los médicos)
    if (active === 'Médicos') {
      return <MedicosPage {...actions} usuario={perfil} />
    }

    // "Resumen" — dashboard global (solo admin, recepcionista, enfermero)
    if (active === 'Resumen') {
      return <Dashboard {...actions} />
    }

    // Otros módulos genéricos
    return <ModulePage active={active} {...actions} />
  }

  const handleCerrarSesion = async () => {
    await cerrarSesion()
    setAuthenticated(false)
    setMenuOpen(false)
    setModal(null)
    setCitaAbierta(null)
  }

  const handleCambiarVistaRol = (nuevoRol: RolUsuario) => {
    setPerfil((prev) => ({ ...prev, rol: nuevoRol }))
    setActive('Resumen')
  }

  if (perfil.rol === 'recepcionista') {
    return (
      <InterfazRecepcionista
        usuario={perfil}
        onCerrarSesion={handleCerrarSesion}
        onCambiarVistaRol={handleCambiarVistaRol}
      />
    )
  }

  if (perfil.rol === 'enfermero') {
    return (
      <InterfazEnfermero
        usuario={perfil}
        onCerrarSesion={handleCerrarSesion}
        onCambiarVistaRol={handleCambiarVistaRol}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      {menuOpen && <BotonCerrarMenu onCerrar={() => setMenuOpen(false)} />}

      <BarraLateral
        activo={active}
        abierto={menuOpen}
        onNavegar={navigate}
        onAbrirModal={openModal}
        onCerrar={() => setMenuOpen(false)}
        rol={perfil.rol}
      />

      <section className="lg:pl-[260px]">
        <BarraSuperior
          onAbrirMenu={() => setMenuOpen(true)}
          onAbrirModal={openModal}
          onCerrarSesion={handleCerrarSesion}
          usuario={perfil}
          onCambiarVistaRol={handleCambiarVistaRol}
          onCambiarRol={(nuevoRol, medicoId, nombre) => {
            setPerfil((prev) => ({
              ...prev,
              rol: nuevoRol,
              medicoId,
              nombre: nombre || (nuevoRol === 'admin' ? 'Administrador Demo' : nuevoRol === 'recepcionista' ? 'Recepcionista Central' : prev.nombre),
            }))
            notify(`Vista cambiada a: ${nuevoRol === 'medico' ? (nombre ?? 'Médico') : nuevoRol.toUpperCase()}`)
          }}
        />

        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-9">
          {renderContenido()}
        </div>
      </section>

      {notice && (
        <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">
          {notice}
          <BotonCerrarAviso onCerrar={() => setNotice('')} />
        </div>
      )}

      {modal === 'Nueva cita' && (
        <ModalNuevaCita
          onClose={() => setModal(null)}
          onSave={(value) => { notify(value ? 'Nueva cita guardado correctamente' : 'Nueva cita listo para completar'); setModal(null) }}
        />
      )}
      {modal !== null && modal.startsWith('Detalle: ') && !Number.isNaN(Number(modal.split(': ')[1])) && (
        <ModalDetalleCita citaId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />
      )}
      {modal !== null && modal.startsWith('HistorialDetalle: ') && !Number.isNaN(Number(modal.split(': ')[1])) && (
        <ModalDetalleCita citaId={Number(modal.split(': ')[1])} tabInicial="historial" onClose={() => setModal(null)} />
      )}
      {modal !== null && modal.startsWith('PacienteDetalle: ') && !Number.isNaN(Number(modal.split(': ')[1])) && (
        <ModalPerfilPaciente pacienteId={Number(modal.split(': ')[1])} rol={perfil.rol} onClose={() => setModal(null)} />
      )}
      {modal !== null && modal.startsWith('Editar: ') && !Number.isNaN(Number(modal.split(': ')[1])) && (
        <ModalEditarCita citaId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />
      )}
      {modal !== null && modal.startsWith('Eliminar: ') && !Number.isNaN(Number(modal.split(': ')[1])) && (
        <ModalConfirmarEliminacion
          citaId={Number(modal.split(': ')[1])}
          onClose={() => setModal(null)}
          onConfirm={() => onEliminarCita(Number(modal.split(': ')[1]))}
        />
      )}
      {(modal === 'Registrar paciente' || modal === 'Nuevo paciente') && (
        <ModalRegistrarPaciente
          onClose={() => setModal(null)}
          onSave={(nombre) => {
            notify(`Paciente "${nombre}" registrado correctamente`)
            setModal(null)
          }}
        />
      )}
      {modal === 'Buscar paciente' && (
        <ModalBuscarPaciente
          onClose={() => setModal(null)}
          onSave={(value) => { notify(value ? 'Buscar paciente guardado correctamente' : 'Buscar paciente listo para completar'); setModal(null) }}
        />
      )}
      {modal === 'Usuarios' && (
        <ModalUsuarios
          onClose={() => setModal(null)}
          onSave={(value) => { notify(value ? 'Usuarios guardado correctamente' : 'Usuarios listo para completar'); setModal(null) }}
        />
      )}
      {modal === 'Ver resultados pendientes' && (
        <ModalResultadosPendientes onClose={() => setModal(null)} />
      )}

      {citaAbierta && (
        <ModalAccionCita
          cita={citaAbierta.cita}
          accion={citaAbierta.accion}
          rol={perfil.rol}
          sinConfirmar={citaAbierta.accion === 'historial' && perfil.rol === 'medico'}
          onClose={() => setCitaAbierta(null)}
          {...accionesCita}
        />
      )}
    </main>
  )
}
