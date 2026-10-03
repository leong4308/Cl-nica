'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Dashboard } from '@/components/modulos/resumen/dashboard'
import { ModulePage } from '@/components/modulos/citas/module-page'
import { BarraLateral } from '@/components/modulos/barra-lateral'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { cargarPerfilSesion, cerrarSesion } from '@/lib/supabase/sesion'
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/supabase/tipos-rol'
import { ClinicModal } from '@/components/modulos/compartidos/modal'
import { ModalAccionCita, type AccionCita } from '@/components/modulos/compartidos/modal-cita'
import { LoginForm } from '@/components/login/login-form'
import {
  actualizarEstadoCita,
  type CitaPanel,
  type EstadoCita,
} from '@/lib/supabase/datos'
import { precargarCita } from '@/lib/supabase/cache-cita'
import { precargarModulos } from '@/lib/supabase/cache-modulos'

/** Cierra el modal de citas y avisa del resultado. */
type CitaEnEdicion = { cita: CitaPanel; accion: AccionCita } | null

export default function Page() {
  const [authenticated, setAuthenticated] = useState(false)
  const [active, setActive] = useState('Resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [citaAbierta, setCitaAbierta] = useState<CitaEnEdicion>(null)
  const [notice, setNotice] = useState('')
  const [perfil, setPerfil] = useState<{ nombre: string; rol: RolUsuario }>({ nombre: 'Usuario', rol: 'paciente' })

  // Precarga módulos, paneles y agendas nada más entrar. Con esto cambiar de
  // pestaña y abrir los modales queda instantáneo, sin estados intermedios.
  useEffect(() => {
    if (!authenticated) return
    precargarModulos()
    precargarCita()
    // Cada vez que se crea o cambia una cita, todo se recalcula en segundo plano
    // para que ninguna vista muestre datos viejos.
    const refrescar = () => { precargarModulos(); precargarCita() }
    window.addEventListener('datos-actualizados', refrescar)
    return () => window.removeEventListener('datos-actualizados', refrescar)
  }, [authenticated])

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  /** Títulos de modal con un formulario real implementado. Cualquier otro
 *  botón (Registrar médico, Nuevo paciente, Filtros, Detalle, Editar…) no
 *  abre nada, en lugar de mostrar un formulario genérico. */
const MODALES_CON_FORMULARIO = ['Usuarios', 'Buscar paciente', 'Nueva cita']

const openModal = (title: string) => {
  if (!MODALES_CON_FORMULARIO.includes(title)) return
  setModal(title)
}
  const navigate = (label: string) => { setActive(label); setMenuOpen(false); setModal(null) }

  /** Aplica un cambio de estado a la cita y devuelve el error, o null si salió bien. */
  const aplicarEstado = async (cita: CitaPanel, estado: EstadoCita, mensaje: string) => {
    const { error } = await actualizarEstadoCita(cita.id, estado)
    if (error) { notify(`No se pudo actualizar: ${error}`); return error }
    notify(mensaje)
    return null
  }

  const accionesCita = {
    onConfirmar: (cita: CitaPanel) => aplicarEstado(cita, 'confirmada', `Cita de ${cita.paciente} confirmada`),
    onRegistrar: (cita: CitaPanel) => aplicarEstado(cita, 'atendida', `Asistencia registrada para ${cita.paciente}`),
    onNoAsistio: (cita: CitaPanel) => aplicarEstado(cita, 'no_asistio', `${cita.paciente} quedó como no asistió`),
    onCancelar: (cita: CitaPanel) => aplicarEstado(cita, 'cancelada_paciente', `Cita de ${cita.paciente} cancelada`),
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
      {menuOpen && <button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}

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
          <button type="button" onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={14} /></button>
        </div>
      )}

      {modal && (
        <ClinicModal
          title={modal}
          onClose={() => setModal(null)}
          onSave={(value) => { notify(value ? `${modal} guardado correctamente` : `${modal} listo para completar`); setModal(null) }}
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
