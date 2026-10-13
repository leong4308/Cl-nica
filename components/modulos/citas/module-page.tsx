'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Search, X } from 'lucide-react'
import { modules } from './configuracion'
import type { ClinicActions, Row } from '../compartidos/types'
import { Stat } from '../compartidos/ui'
import { Status } from './estado'
import { BotonFiltrarModulo } from './filtrar'
import { BotonExportarModulo } from './exportar'
import { AccionesFilaModulo } from './acciones-fila'
import { BotonNuevaCitaModulo } from './nueva-cita'
import { BotonAccionModulo } from './boton-accion'
import { cargarModulo } from '@/lib/supabase/datos'
import { guardarModulo, leerModulo } from '@/lib/supabase/cache-modulos'
import { registrarCitaRapida } from '@/lib/supabase/cache-detalle-cita'

type DatosModulo = { modulo: string; filas: Row[]; error: string | null }

export function ModulePage({ active, notify, openModal, onAccion, rol }: ClinicActions & { active: string }) {
  const [busqueda, setBusqueda] = useState('')
  const [version, setVersion] = useState(0)
  const config = modules[active]

  const [datos, setDatos] = useState<DatosModulo | null>(null)

  useEffect(() => {
    let vigente = true
    cargarModulo(active).then((resultado) => {
      if (!vigente) return
      setDatos({ modulo: active, filas: resultado.filas, error: resultado.error })
      guardarModulo(active, resultado.filas, resultado.error)

      if (active === 'Citas') {
        resultado.filas.forEach((row) => {
          if (row.length >= 6) {
            const idNum = Number(row[5])
            if (!Number.isNaN(idNum)) {
              registrarCitaRapida({
                id: idNum,
                paciente: row[1] ?? '',
                medico: row[2] ?? '',
                motivo: row[3] ?? '',
                estado: row[9] || row[4] || 'pendiente',
                inicio: row[6] || new Date().toISOString(),
                fin: row[7] || row[6] || new Date().toISOString(),
                pacienteId: row[8] ? Number(row[8]) : undefined,
              })
            }
          }
        })
      }
    })
    return () => { vigente = false }
  }, [active, version])

  const cacheado = leerModulo(active)
  const filas = datos?.modulo === active ? datos.filas : (cacheado?.filas ?? [])
  const error = datos?.modulo === active ? datos.error : (cacheado?.error ?? null)
  const cargando = datos?.modulo !== active && cacheado === null

  const filasFiltradas = busqueda.trim()
    ? filas.filter((row) =>
      row
        .slice(0, config?.columns.length ?? row.length)
        .some((celda) => celda.toLowerCase().includes(busqueda.trim().toLowerCase()))
    )
    : filas

  useEffect(() => {
    function alGuardar() { setVersion((v) => v + 1) }
    window.addEventListener('datos-actualizados', alGuardar)
    return () => window.removeEventListener('datos-actualizados', alGuardar)
  }, [])

  if (!config) return null
  const Icon = config.icon

  const esMedico = rol === 'medico'
  const accionOcultaParaMedico = esMedico && (config.action === 'Nueva cita' || config.action === 'Nuevo paciente')

  const botonPrincipal = accionOcultaParaMedico
    ? null
    : config.action === 'Nueva cita'
      ? <BotonNuevaCitaModulo onAbrirModal={openModal} />
      : <BotonAccionModulo etiqueta={config.action} onAbrirModal={openModal} />
  return (
    <section>
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600"><Icon size={17} />{config.eyebrow}</p>
          <h2 className="text-[27px] font-bold tracking-tight">{config.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
        <div className="flex gap-2">
          <BotonFiltrarModulo modulo={active} onAbrirModal={openModal} />
          {botonPrincipal}
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat icon={Icon} label="Registros totales" value={cargando ? '—' : String(filas.length)} meta="Desde Supabase" tone="blue" />
        <Stat icon={Icon} label="Estado de conexión" value={error ? 'Error' : 'Activo'} meta={error ? 'Revisa tus políticas RLS' : 'Consulta en vivo'} tone={error ? 'orange' : 'green'} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold">Listado de {active.toLowerCase()}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {busqueda.trim()
                ? `${filasFiltradas.length} de ${filas.length} registros encontrados`
                : 'Todos los registros del sistema'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={`Buscar en ${active.toLowerCase()}...`}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <BotonExportarModulo modulo={active} onAvisar={notify} />
          </div>
        </div>

        {cargando && <div className="px-5 py-16" />}

        {!cargando && error && <div className="flex flex-col items-center gap-2 px-5 py-16 text-center"><AlertCircle size={22} className="text-amber-500" /><p className="text-sm font-semibold text-slate-700">No se pudieron cargar los datos</p><p className="max-w-md text-xs text-slate-400">{error}</p></div>}

        {!cargando && !error && filas.length === 0 && <div className="px-5 py-16 text-center text-sm text-slate-400">No hay registros en la base de datos.</div>}

        {!cargando && !error && filas.length > 0 && filasFiltradas.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center text-xs text-slate-400">
            <p>No se encontraron resultados para «<span className="font-semibold text-slate-600">{busqueda}</span>».</p>
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="mt-1 font-semibold text-blue-600 hover:underline"
            >
              Limpiar búsqueda
            </button>
          </div>
        )}

        {!cargando && !error && filasFiltradas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead><tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">{config.columns.map((column) => <th className="px-5 py-3" key={column}>{column}</th>)}<th className="px-5 py-3">Acciones</th></tr></thead>
              <tbody>
                {filasFiltradas.map((row, i) => {
                  const displayCells = row.slice(0, config.columns.length)
                  const id = row[config.columns.length] ?? row[0]
                  return (
                    <tr className="border-b border-slate-50 text-xs last:border-0" key={`${id}-${i}`}>
                      {displayCells.map((cell, j) => (
                        <td className="px-5 py-4 text-slate-600" key={`${cell}-${j}`}>
                          {j === displayCells.length - 1 ? <Status text={cell} /> : cell}
                        </td>
                      ))}
                      <td className="px-5 py-3">
                        <AccionesFilaModulo
                          id={id}
                          fila={row}
                          modulo={active}
                          esMedico={esMedico}
                          onAbrirModal={openModal}
                          onAccion={onAccion}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
