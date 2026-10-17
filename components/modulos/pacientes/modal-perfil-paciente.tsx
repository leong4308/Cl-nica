'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays,
  ClipboardList,
  History,
  Phone,
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

type Tab = 'perfil' | 'historial'

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
  const [tab, setTab] = useState<Tab>('perfil')

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

    // Pre-cargar historial silenciosamente para que la pestaña también sea instantánea
    if (!cacheActual.historial) {
      cargarHistorialPaciente(pacienteId).then(({ filas }) => {
        if (!vigente) return
        if (filas) {
          setHistorial(filas)
          registrarHistorialPacienteEnCache(pacienteId, filas)
        }
      })
    }

    return () => { vigente = false }
  }, [pacienteId])

  const cargarHistorial = () => {
    if (historial !== null || cargandoHistorial) return
    setCargandoHistorial(true)
    cargarHistorialPaciente(pacienteId).then(({ filas, error: e }) => {
      setCargandoHistorial(false)
      if (!e && filas) {
        setHistorial(filas)
        registrarHistorialPacienteEnCache(pacienteId, filas)
      }
    })
  }

  const handleTab = (t: Tab) => {
    setTab(t)
    if (t === 'historial') cargarHistorial()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="my-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl scale-in-95 transition-all"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cabecera instantánea */}
        <div className="border-b border-slate-100 bg-gradient-to-br from-blue-50 to-slate-50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
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
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-slate-100 bg-white px-5 pt-2">
          <button
            type="button"
            onClick={() => handleTab('perfil')}
            className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-semibold transition-colors ${
              tab === 'perfil'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User size={14} />
            Datos del paciente
          </button>
          {rol !== 'recepcionista' && (
            <button
              type="button"
              onClick={() => handleTab('historial')}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-semibold transition-colors ${
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!cargando && error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {perfil && tab === 'perfil' && (
            <div className="space-y-3">
              {/* Datos personales */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User size={12} />
                  Datos personales
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DataRow label="Nombre completo" value={perfil.nombre} />
                  <DataRow label="Género" value={perfil.genero || '—'} />
                  <DataRow label="Fecha de nacimiento" value={perfil.fechaNacimiento || '—'} icon={<CalendarDays size={13} className="text-blue-500" />} />
                  <DataRow label="Teléfono" value={perfil.telefono || '—'} icon={<Phone size={13} className="text-blue-500" />} />
                </div>
              </div>
            </div>
          )}

          {cargando && !perfil && (
            <div className="space-y-3 py-6">
              <div className="h-24 rounded-xl bg-slate-50 border border-slate-100" />
              <div className="h-20 rounded-xl bg-slate-50 border border-slate-100" />
            </div>
          )}

          {rol !== 'recepcionista' && tab === 'historial' && (
            <div>
              {cargandoHistorial && !historial ? (
                <div className="space-y-3 py-4">
                  <div className="h-16 rounded-xl bg-slate-50 border border-slate-100" />
                  <div className="h-16 rounded-xl bg-slate-50 border border-slate-100" />
                </div>
              ) : historial !== null && historial.length === 0 ? (
                <div className="py-12 text-center">
                  <ClipboardList size={28} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-xs font-medium text-slate-500">Sin consultas previas registradas</p>
                  <p className="mt-1 text-[11px] text-slate-400">Este paciente no tiene expedientes en el sistema.</p>
                </div>
              ) : historial === null ? (
                <div className="space-y-3 py-4">
                  <div className="h-16 rounded-xl bg-slate-50 border border-slate-100" />
                </div>
              ) : (
                <div className="space-y-3">
                  {historial?.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                        <span className="font-bold text-xs text-slate-900">{item.motivo}</span>
                        <span className="text-[11px] text-slate-400">{item.fecha}</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-700">
                        <p><span className="font-semibold text-slate-800">Diagnóstico:</span> {item.diagnostico}</p>
                        <p><span className="font-semibold text-slate-800">Receta:</span> {item.receta}</p>
                        {item.notas && (
                          <p className="text-slate-500"><span className="font-semibold text-slate-700">Notas:</span> {item.notas}</p>
                        )}
                        <p className="text-[11px] text-slate-400">Atendió: {item.medico}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
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
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-800">
        {icon}
        {value}
      </p>
    </div>
  )
}
