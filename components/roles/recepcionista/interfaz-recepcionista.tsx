'use client'

import { PanelEnvios } from '@/components/modulos/gestion/panel-envios'
import { PanelEspera } from '@/components/modulos/gestion/panel-espera'
import { PanelConsultorios } from '@/components/modulos/gestion/panel-consultorios'
import { useState } from 'react'
import { abrirSeccionCuenta } from '@/lib/cuenta/menu'
import { BarraLateralRecepcionista } from './barra-lateral'
import { navItemsRecepcion } from './barra-lateral/navegacion/items-menu'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { PanelRecepcion, DirectorioRecepcion } from './panel-recepcion'
import { ModalRegistrarPaciente } from '@/components/modulos/resumen/acciones-rapidas/registrar-paciente'
import { ModalNuevaCita } from '@/components/modulos/resumen/acciones-rapidas/nueva-cita'
import { ModalEditarCita } from '@/components/modulos/citas'
import { ModalPerfilPaciente, ModalEditarPaciente } from '@/components/modulos/pacientes'
import { BotonCerrarMenu, BotonCerrarAviso } from '@/app/botones-pagina'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

type Props = { paginaInicio?: string; usuario: { nombre: string; rol: RolUsuario }; onCerrarSesion: () => void; onCambiarVistaRol?: (rol: RolUsuario) => void }
export function InterfazRecepcionista({ usuario, paginaInicio, onCerrarSesion, onCambiarVistaRol }: Props) {
  const [active, setActive] = useState(navItemsRecepcion.some(([label]) => label === paginaInicio) ? paginaInicio! : 'Resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const openModal = (titulo: string) => {
    if (abrirSeccionCuenta(titulo)) return
    if (['Registrar paciente', 'Nuevo paciente', 'Nueva cita'].includes(titulo) || /^(PacienteDetalle|PacienteEditar|Editar): [0-9]+$/.test(titulo)) setModal(titulo)
  }
  const navigate = (seccion: string) => { if (navItemsRecepcion.some(([label]) => label === seccion)) { setActive(seccion); setMenuOpen(false) } }
  return <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
    {menuOpen && <BotonCerrarMenu onCerrar={() => setMenuOpen(false)} />}
    <BarraLateralRecepcionista activo={active} abierto={menuOpen} onNavegar={navigate} onCerrar={() => setMenuOpen(false)} />
    <section className="lg:pl-[260px]">
      <BarraSuperior onAbrirMenu={() => setMenuOpen(true)} onAbrirModal={openModal} onCerrarSesion={onCerrarSesion} usuario={usuario} onCambiarVistaRol={onCambiarVistaRol} />
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-9">{active === 'Comunicaciones' ? <PanelEnvios /> : active === 'Lista de espera' ? <PanelEspera rol="recepcionista" onPaciente={id => openModal(`PacienteDetalle: ${id}`)} /> : active === 'Consultorios' ? <PanelConsultorios rol="recepcionista" /> : active === 'Pacientes' ? <DirectorioRecepcion openModal={openModal} /> : <PanelRecepcion seccion={active} nombre={usuario.nombre} openModal={openModal} />}</div>
    </section>
    {notice && <div role="status" className="fixed bottom-6 right-6 z-50 flex max-w-[90vw] items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">{notice}<BotonCerrarAviso onCerrar={() => setNotice('')} /></div>}
    {(modal === 'Registrar paciente' || modal === 'Nuevo paciente') && <ModalRegistrarPaciente soloAdministrativo onClose={() => setModal(null)} onSave={nombre => { setNotice(`Paciente «${nombre}» registrado.`); window.dispatchEvent(new Event('datos-actualizados')); setModal(null) }} />}
    {modal === 'Nueva cita' && <ModalNuevaCita onClose={() => setModal(null)} onSave={() => { setNotice('Cita agendada correctamente.'); window.dispatchEvent(new Event('datos-actualizados')); setModal(null) }} />}
    {modal?.startsWith('PacienteEditar: ') && <ModalEditarPaciente key={modal} pacienteId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />}
    {modal?.startsWith('PacienteDetalle: ') && <ModalPerfilPaciente key={modal} pacienteId={Number(modal.split(': ')[1])} rol="recepcionista" onClose={() => setModal(null)} />}
    {modal?.startsWith('Editar: ') && <ModalEditarCita key={modal} citaId={Number(modal.split(': ')[1])} onClose={() => setModal(null)} />}
  </main>
}
