'use client'

import { useState } from 'react'
import { BarraLateralRecepcionista } from './barra-lateral'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { DashboardRecepcionista } from './resumen'
import { ModulePage } from '@/components/modulos/citas/module-page'
import { ModalRegistrarPaciente } from '@/components/modulos/resumen/acciones-rapidas/registrar-paciente'
import { ModalNuevaCita } from '@/components/modulos/resumen/acciones-rapidas/nueva-cita'
import { ModalBuscarPaciente } from '@/components/modulos/resumen/acciones-rapidas/buscar-paciente'
import { ModalAccionCita, type AccionCita } from '@/components/modulos/resumen/proximas-citas/modal-accion-cita'
import { ModalDetalleCita, ModalEditarCita } from '@/components/modulos/citas'
import { ModalPerfilPaciente } from '@/components/modulos/pacientes'
import { ModalConfirmarEliminacion } from '@/components/modulos/citas/confirmar-eliminacion/modal-confirmar-eliminacion'
import { BotonCerrarMenu, BotonCerrarAviso } from '@/app/botones-pagina'
import { actualizarEstadoCita, eliminarCita, type CitaPanel, type EstadoCita } from '@/lib/supabase/datos'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

type PropsInterfazRecepcionista = {
  usuario: { nombre: string; rol: RolUsuario }
  onCerrarSesion: () => void
  onCambiarVistaRol?: (nuevoRol: RolUsuario) => void
}

type CitaEnEdicion = { cita: CitaPanel; accion: AccionCita } | null

export function InterfazRecepcionista({
  usuario,
  onCerrarSesion,
  onCambiarVistaRol,
}: PropsInterfazRecepcionista) {
  const [active, setActive] = useState('Resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [citaAbierta, setCitaAbierta] = useState<CitaEnEdicion>(null)

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const MODALES_CON_FORMULARIO = ['Registrar paciente', 'Nuevo paciente', 'Nueva cita', 'Buscar paciente']
  const MODALES_ACCIONES_CITA = ['Detalle', 'Editar', 'Eliminar', 'PacienteDetalle']

  const openModal = (title: string) => {
    const esAccionCita = MODALES_ACCIONES_CITA.some((prefijo) => title.startsWith(prefijo))
    if (MODALES_CON_FORMULARIO.includes(title) || esAccionCita) {
      setModal(title)
    } else {
      notify(`Acción "${title}" procesada`)
    }
  }

  const navigate = (label: string) => {
    setActive(label)
    setMenuOpen(false)
  }

  const aplicarEstado = async (cita: CitaPanel, nuevoEstado: EstadoCita, mensajeExito: string) => {
    const { error } = await actualizarEstadoCita(cita.id, nuevoEstado)
    if (error) {
      notify(`Error: ${error}`)
      return error
    }
    notify(mensajeExito)
    return null
  }

  const onEliminarCita = async (citaId: number) => {
    const { error } = await eliminarCita(citaId)
    if (error) {
      notify(`No se pudo eliminar: ${error}`)
      return error
    }
    notify('Cita eliminada correctamente')
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
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      {menuOpen && <BotonCerrarMenu onCerrar={() => setMenuOpen(false)} />}

      <BarraLateralRecepcionista
        activo={active}
        abierto={menuOpen}
        onNavegar={navigate}
        onCerrar={() => setMenuOpen(false)}
      />

      <section className="lg:pl-[260px]">
        <BarraSuperior
          onAbrirMenu={() => setMenuOpen(true)}
          onAbrirModal={openModal}
          onCerrarSesion={onCerrarSesion}
          usuario={usuario}
          onCambiarVistaRol={onCambiarVistaRol}
        />

        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-9">
          {active === 'Resumen' ? (
            <DashboardRecepcionista
              nombreUsuario={usuario.nombre}
              onAccionCita={(cita, accion) => setCitaAbierta({ cita, accion })}
              {...actions}
            />
          ) : (
            <ModulePage active={active} {...actions} />
          )}
        </div>
      </section>

      {/* Avisos flotantes */}
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl"
        >
          {notice}
          <BotonCerrarAviso onCerrar={() => setNotice('')} />
        </div>
      )}

      {/* Modales */}
      {(modal === 'Registrar paciente' || modal === 'Nuevo paciente') && (
        <ModalRegistrarPaciente
          onClose={() => setModal(null)}
          onSave={(nombre) => {
            notify(`Paciente "${nombre}" registrado correctamente`)
            setModal(null)
          }}
        />
      )}

      {modal === 'Nueva cita' && (
        <ModalNuevaCita
          onClose={() => setModal(null)}
          onSave={(value) => {
            notify(value ? 'Cita guardada correctamente' : 'Nueva cita registrada')
            setModal(null)
          }}
        />
      )}

      {modal === 'Buscar paciente' && (
        <ModalBuscarPaciente
          onClose={() => setModal(null)}
          onSave={(value) => {
            notify(value ? 'Búsqueda completada' : 'Listo')
            setModal(null)
          }}
        />
      )}

      {modal !== null && modal.startsWith('Detalle: ') && (
        <ModalDetalleCita citaId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />
      )}

      {modal !== null && modal.startsWith('PacienteDetalle: ') && (
        <ModalPerfilPaciente pacienteId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />
      )}

      {modal !== null && modal.startsWith('Editar: ') && (
        <ModalEditarCita citaId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />
      )}

      {modal !== null && modal.startsWith('Eliminar: ') && (
        <ModalConfirmarEliminacion
          citaId={Number(modal.split(': ')[1])}
          onClose={() => setModal(null)}
          onConfirm={() => onEliminarCita(Number(modal.split(': ')[1]))}
        />
      )}

      {citaAbierta && (
        <ModalAccionCita
          cita={citaAbierta.cita}
          accion={citaAbierta.accion}
          rol={usuario.rol}
          onClose={() => setCitaAbierta(null)}
          {...accionesCita}
        />
      )}
    </main>
  )
}
