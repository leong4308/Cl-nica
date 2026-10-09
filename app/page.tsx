'use client'

import { useEffect, useState } from 'react'
import { Dashboard } from '@/components/modulos/resumen/dashboard'
import { ModulePage } from '@/components/modulos/citas/module-page'
import { BarraLateral } from '@/components/modulos/barra-lateral'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { BotonCerrarAviso, BotonCerrarMenu } from './botones-pagina'
import { cargarPerfilSesion, cerrarSesion } from '@/lib/supabase/sesion'
import { type RolUsuario } from '@/lib/supabase/tipos-rol'
import { ModalUsuarios } from '@/components/modulos/barra-lateral/usuarios'
import { ModalBuscarPaciente } from '@/components/modulos/resumen/acciones-rapidas/buscar-paciente'
import { ModalNuevaCita } from '@/components/modulos/resumen/acciones-rapidas/nueva-cita'
import { ModalAccionCita, type AccionCita } from '@/components/modulos/resumen/proximas-citas/modal-accion-cita'
import { LoginForm } from '@/components/login/login-form'
import {
  actualizarEstadoCita,
  eliminarCita,
  type CitaPanel,
  type EstadoCita,
} from '@/lib/supabase/datos'
import { ModalDetalleCita, ModalEditarCita } from '@/components/modulos/citas'
import { ModalConfirmarEliminacion } from '@/components/modulos/citas/confirmar-eliminacion/modal-confirmar-eliminacion'
import { precargarCita } from '@/lib/supabase/cache-cita'
import { precargarModulos } from '@/lib/supabase/cache-modulos'

type CitaEnEdicion = { cita: CitaPanel; accion: AccionCita } | null

export default function Page() {
  const [authenticated, setAuthenticated] = useState(false)
  const [active, setActive] = useState('Resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [citaAbierta, setCitaAbierta] = useState<CitaEnEdicion>(null)
  const [notice, setNotice] = useState('')
  const [perfil, setPerfil] = useState<{ nombre: string; rol: RolUsuario }>({ nombre: 'Usuario', rol: 'paciente' })

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

const MODALES_CON_FORMULARIO = ['Usuarios', 'Buscar paciente', 'Nueva cita']
const MODALES_ACCIONES_CITA = ['Detalle', 'Editar', 'Eliminar']

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
  }

  if (!authenticated) {
    return <LoginForm onSuccess={async () => { setPerfil(await cargarPerfilSesion()); setAuthenticated(true) }} />
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
        esAdmin={perfil.rol === 'admin'}
      />

      <section className="lg:pl-[260px]">
        <BarraSuperior
          onAbrirMenu={() => setMenuOpen(true)}
          onAbrirModal={openModal}
          onCerrarSesion={async () => {
            await cerrarSesion()
            setAuthenticated(false)
            setMenuOpen(false)
            setModal(null)
            setCitaAbierta(null)
          }}
          usuario={perfil}
        />

        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-9">
          {active === 'Resumen'
            ? <Dashboard {...actions} />
            : <ModulePage active={active} {...actions} />}
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
      {(modal !== null && modal.startsWith('Detalle: ')) && (
        <ModalDetalleCita citaId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />
      )}
      {(modal !== null && modal.startsWith('Editar: ')) && (
        <ModalEditarCita citaId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />
      )}
      {(modal !== null && modal.startsWith('Eliminar: ')) && (
        <ModalConfirmarEliminacion
          citaId={Number(modal.split(': ')[1])}
          onClose={() => setModal(null)}
          onConfirm={() => onEliminarCita(Number(modal.split(': ')[1]))}
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

      {citaAbierta && (
        <ModalAccionCita
          cita={citaAbierta.cita}
          accion={citaAbierta.accion}
          onClose={() => setCitaAbierta(null)}
          {...accionesCita}
        />
      )}
    </main>
  )
}
