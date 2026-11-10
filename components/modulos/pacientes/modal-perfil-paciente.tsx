'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays,
  History,
  Phone,
  ShieldAlert,
  User,
  X,
} from 'lucide-react'
import {
  cargarHistorialPaciente,
  cargarPerfilPaciente,
  type HistorialPaciente,
  type PerfilPacienteDetalle,
} from '@/lib/supabase/datos'
import {
  obtenerDatosPacienteInicial,
  registrarHistorialPacienteEnCache,
  registrarPerfilPacienteEnCache,
} from '@/lib/supabase/cache-pacientes'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'
import { Status } from '@/components/modulos/citas/estado'
import { FichaImportantePaciente } from './ficha-importante-paciente'
import { ModalEditarPaciente } from './modal-editar-paciente'
import { HistorialClinicoPaciente } from './historial-clinico-paciente'
import { MedicosTratantes } from './medicos-tratantes'

type Tab = 'perfil' | 'importante' | 'historial'

export function ModalPerfilPaciente({
  pacienteId,
  rol,
  onClose,
}: {
  pacienteId: number
  rol?: RolUsuario
  onClose: () => void
}) {
  const datosIniciales = obtenerDatosPacienteInicial(pacienteId)
  const [perfil, setPerfil] = useState<PerfilPacienteDetalle | null>(datosIniciales.perfil)
  const [historial, setHistorial] = useState<HistorialPaciente[] | null>(datosIniciales.historial)
  const [cargando, setCargando] = useState(!datosIniciales.perfil)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(rol === 'enfermero' ? 'importante' : 'perfil')
  const [editando, setEditando] = useState(false)
  const [editandoImportante, setEditandoImportante] = useState(false)
  const [guardandoImportante, setGuardandoImportante] = useState(false)
  const [solicitudEdicion, setSolicitudEdicion] = useState(0)
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null)
  const [revisionHistorial, setRevisionHistorial] = useState(0)

  useEffect(() => {
    let vigente = true
    const cacheActual = obtenerDatosPacienteInicial(pacienteId)
    if (cacheActual.perfil) {
      setPerfil(cacheActual.perfil)
      setCargando(false)
    }
    if (cacheActual.historial) {
      setHistorial(cacheActual.historial)
    }

    // Carga o actualiza en background de manera transparente
    cargarPerfilPaciente(pacienteId).then(({ perfil: p, error: e }) => {
      if (!vigente) return
      setCargando(false)
      if (e && !cacheActual.perfil) {
        setError(e)
        return
      }
      if (p) {
        setPerfil(p)
        registrarPerfilPacienteEnCache(p)
      }
    })

    return () => { vigente = false }
  }, [pacienteId])

  useEffect(() => {
    if (rol === 'recepcionista') return
    let vigente = true
    setCargandoHistorial(true)
    setErrorHistorial(null)
    cargarHistorialPaciente(pacienteId).then(({ filas, error: e }) => {
      if (!vigente) return
      if (e) { setErrorHistorial('No se pudo actualizar el historial. Inténtalo de nuevo.'); return }
      setHistorial(filas)
      registrarHistorialPacienteEnCache(pacienteId, filas)
    }).catch(() => { if (vigente) setErrorHistorial('No se pudo conectar para cargar el historial.') })
      .finally(() => { if (vigente) setCargandoHistorial(false) })
    return () => { vigente = false }
  }, [pacienteId, rol, revisionHistorial])

  const handleTab = (t: Tab) => {
    setTab(t)
    setSolicitudEdicion(0)
  }

  if (editando) return <ModalEditarPaciente pacienteId={pacienteId} onClose={() => setEditando(false)} onSave={() => {
    setEditando(false)
    cargarPerfilPaciente(pacienteId).then(({ perfil: actualizado }) => { if (actualizado) { setPerfil(actualizado); registrarPerfilPacienteEnCache(actualizado) } })
  }} />

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perfil-paciente-titulo"
      onMouseDown={() => { if (!guardandoImportante) onClose() }}
    >
      <div
        className="my-auto flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cabecera instantánea */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-4"><div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl font-semibold text-blue-700 sm:flex">{perfil?.nombre.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || <User size={26} />}</div><div className="min-w-0"><p className="mb-1 text-xs font-semibold text-blue-600">PERFIL DEL PACIENTE</p>
              <h3 id="perfil-paciente-titulo" className="break-words text-xl font-semibold text-slate-900">
                {perfil?.nombre || 'Paciente'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                ID: <span className="font-semibold text-slate-700">PAC-{String(pacienteId).padStart(5, '0')}</span>
                {perfil && (
                  <span className="ml-2 inline-flex align-middle">
                    <Status text={perfil.estaActivo ? 'Activo' : 'Inactivo'} />
                  </span>
                )}
              </p>
              <p className="mt-2 text-sm text-slate-500">Información personal, alertas y seguimiento clínico.</p>
            </div></div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              disabled={guardandoImportante}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div role="tablist" aria-label="Información del paciente" className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-100 bg-white px-5 pt-3">
          <button
            type="button"
            role="tab"
            disabled={guardandoImportante || editandoImportante}
            aria-selected={tab === 'perfil'}
            onClick={() => handleTab('perfil')}
            className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-semibold transition-colors shrink-0 ${
              tab === 'perfil'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User size={14} />
            Datos del paciente
          </button>

          <button
            type="button"
            role="tab"
            disabled={guardandoImportante || editandoImportante}
            aria-selected={tab === 'importante'}
            onClick={() => handleTab('importante')}
            className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-bold transition-colors shrink-0 ${
              tab === 'importante'
                ? 'border-amber-600 text-amber-700 bg-amber-50/40 rounded-t-lg'
                : 'border-transparent text-amber-700/80 hover:text-amber-800'
            }`}
          >
            <ShieldAlert size={14} className="text-amber-600" />
            Importante
          </button>

          {rol !== 'recepcionista' && (
            <button
              type="button"
              role="tab"
            disabled={guardandoImportante || editandoImportante}
              aria-selected={tab === 'historial'}
              onClick={() => handleTab('historial')}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-semibold transition-colors shrink-0 ${
                tab === 'historial'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History size={14} />
              Historial clínico
            </button>
          )}
        </div>

        {/* Contenido instantáneo */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {!cargando && error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {perfil && tab === 'perfil' && (
            <div className="space-y-3">
              {rol === 'admin' && <MedicosTratantes pacienteId={pacienteId} />}
              {/* Datos personales */}
              <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User size={12} />
                  Datos personales
                </p>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <DataRow label="Nombre completo" value={perfil.nombre} />
                  <DataRow label="Género" value={perfil.genero || '—'} />
                  <DataRow label="Fecha de nacimiento" value={perfil.fechaNacimiento || '—'} icon={<CalendarDays size={13} className="text-blue-500" />} />
                  <DataRow label="Teléfono" value={perfil.telefono || '—'} icon={<Phone size={13} className="text-blue-500" />} />
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA IMPORTANTE */}
          {tab === 'importante' && perfil && (
            <FichaImportantePaciente
              pacienteId={pacienteId}
              notasMedicasRaw={perfil.notasMedicas}
              solicitudEdicion={solicitudEdicion}
              onEditandoChange={setEditandoImportante}
              onGuardandoChange={setGuardandoImportante}
              rol={rol}
              onActualizado={(nuevaFicha) => {
                setPerfil((prev) => (prev ? { ...prev, notasMedicas: JSON.stringify(nuevaFicha) } : null))
              }}
            />
          )}

          {cargando && !perfil && (
            <div className="space-y-3 py-6">
              <div className="h-24 rounded-xl bg-slate-50 border border-slate-100" />
              <div className="h-20 rounded-xl bg-slate-50 border border-slate-100" />
            </div>
          )}

          {rol !== 'recepcionista' && tab === 'historial' && (
            <HistorialClinicoPaciente historial={historial} cargando={cargandoHistorial} error={errorHistorial} onReintentar={() => setRevisionHistorial((v) => v + 1)} />
          )}
        </div>

        {/* Pie */}
        <div className="flex shrink-0 justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4">
          {['admin', 'medico', 'enfermero', 'recepcionista'].includes(rol ?? '') && <button type="button" disabled={guardandoImportante || editandoImportante || cargando} onClick={(event) => { event.preventDefault(); if (tab === 'importante') setSolicitudEdicion((v) => v + 1); else setEditando(true) }} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">{tab === 'importante' ? 'Editar alertas y antecedentes' : tab === 'historial' ? 'Editar datos personales' : 'Editar información'}</button>}
          <button
            type="button"
            onClick={onClose}
            disabled={guardandoImportante}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function DataRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 flex items-center gap-2 break-words text-sm font-semibold text-slate-800">
        {icon}
        {value}
      </p>
    </div>
  )
}
