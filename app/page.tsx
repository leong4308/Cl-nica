'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Dashboard } from '@/components/modulos/resumen/dashboard'
import { ModulePage } from '@/components/modulos/citas/module-page'
import { BarraLateral } from '@/components/modulos/barra-lateral'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { ClinicModal } from '@/components/modulos/compartidos/modal'
import { LoginForm } from '@/components/login/login-form'

export default function Page() {
  const [authenticated, setAuthenticated] = useState(false); const [active, setActive] = useState('Resumen'); const [menuOpen, setMenuOpen] = useState(false); const [modal, setModal] = useState<string | null>(null); const [notice, setNotice] = useState(''); const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2400) }; const openModal = (title: string) => setModal(title); const navigate = (label: string) => { setActive(label); setMenuOpen(false); setModal(null) }; const actions = { notify, openModal, navigate, addAppointment: (appointment: string[]) => window.dispatchEvent(new CustomEvent('cita-creada', { detail: appointment })) };
  if (!authenticated) return <LoginForm onSuccess={() => setAuthenticated(true)} />
  return <main className="min-h-screen bg-[#f7f9fc] text-slate-900">{menuOpen && <button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}<BarraLateral activo={active} abierto={menuOpen} onNavegar={navigate} onAbrirModal={openModal} onCerrar={() => setMenuOpen(false)} /><section className="lg:pl-[260px]"><BarraSuperior onAbrirMenu={() => setMenuOpen(true)} onAbrirModal={openModal} onCerrarSesion={() => { setAuthenticated(false); setMenuOpen(false); setModal(null) }} /><div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-9">{active === 'Resumen' ? <Dashboard {...actions} /> : <ModulePage active={active} {...actions} />}</div></section>{notice && <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={14} /></button></div>}{modal && <ClinicModal title={modal} onClose={() => setModal(null)} onSave={value => { notify(value ? `${modal} guardado correctamente` : `${modal} listo para completar`); setModal(null) }} />}</main>
}
