'use client'

import { useState } from 'react'
import { BarraLateralEnfermero } from './barra-lateral'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { DashboardEnfermero } from './resumen'
import { ModulePage } from '@/components/modulos/citas/module-page'
import { ModalRegistrarPaciente } from '@/components/modulos/resumen/acciones-rapidas/registrar-paciente'
import { ModalBuscarPaciente } from '@/components/modulos/resumen/acciones-rapidas/buscar-paciente'
import { BotonCerrarMenu, BotonCerrarAviso } from '@/app/botones-pagina'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

type PropsInterfazEnfermero = {
  usuario: { nombre: string; rol: RolUsuario }
  onCerrarSesion: () => void
  onCambiarVistaRol?: (nuevoRol: RolUsuario) => void
}

export function InterfazEnfermero({
  usuario,
  onCerrarSesion,
  onCambiarVistaRol,
}: PropsInterfazEnfermero) {
  const [active, setActive] = useState('Resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const MODALES_PERMITIDOS = ['Registrar paciente', 'Nuevo paciente', 'Buscar paciente']

  const openModal = (title: string) => {
    if (MODALES_PERMITIDOS.includes(title)) {
      setModal(title)
    } else {
      notify(`Acción "${title}" lista para completar`)
    }
  }

  const navigate = (label: string) => {
    setActive(label)
    setMenuOpen(false)
  }

  const actions = {
    notify,
    openModal,
    navigate,
    addAppointment: (appointment: string[]) => window.dispatchEvent(new CustomEvent('cita-creada', { detail: appointment })),
    onAccion: () => {},
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      {menuOpen && <BotonCerrarMenu onCerrar={() => setMenuOpen(false)} />}

      <BarraLateralEnfermero
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
            <DashboardEnfermero
              nombreUsuario={usuario.nombre}
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

      {/* Modales permitidos */}
      {(modal === 'Registrar paciente' || modal === 'Nuevo paciente') && (
        <ModalRegistrarPaciente
          onClose={() => setModal(null)}
          onSave={(nombre) => {
            notify(`Paciente "${nombre}" ingresado correctamente`)
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
    </main>
  )
}
