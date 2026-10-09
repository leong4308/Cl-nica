'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, Filter, Plus, RefreshCw } from 'lucide-react'
import { getModuleStats, modules } from '../compartidos/data'
import type { ClinicActions, Row } from '../compartidos/types'
import { ActionButton, RowActions, Stat, Status } from '../compartidos/ui'
import { obtenerDatosModulo } from '@/lib/consultas'

export function ModulePage({ active, notify, openModal }: ClinicActions & { active: string }) {
  const config = modules[active]
  const [rows, setRows] = useState<Row[]>([])
  const [cargando, setCargando] = useState(true)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    try {
      const datos = await obtenerDatosModulo(active)
      setRows(datos)
    } catch (err) {
      console.error('Error cargando módulo:', active, err)
    } finally {
      setCargando(false)
    }
  }, [active])

  useEffect(() => {
    void cargarDatos()

    const handleActualizacion = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (!customEvent.detail || customEvent.detail === active) {
        void cargarDatos()
      }
    }

    window.addEventListener('cita-actualizada', handleActualizacion)
    window.addEventListener('datos-actualizados', handleActualizacion)

    return () => {
      window.removeEventListener('cita-actualizada', handleActualizacion)
      window.removeEventListener('datos-actualizados', handleActualizacion)
    }
  }, [active, cargarDatos])

  if (!config) return null
  const Icon = config.icon

  return (
    <section>
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
            <Icon size={17} />
            {config.eyebrow}
          </p>
          <h2 className="text-[27px] font-bold tracking-tight">{config.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
        <div className="flex gap-2">
          <ActionButton
            icon={RefreshCw}
            onClick={() => {
              void cargarDatos()
              notify('Datos actualizados desde Supabase')
            }}
          >
            Actualizar
          </ActionButton>
          <ActionButton icon={Filter} onClick={() => openModal(`Filtros de ${active}`)}>
            Filtrar
          </ActionButton>
          <ActionButton primary icon={Plus} onClick={() => openModal(config.action)}>
            {config.action}
          </ActionButton>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {getModuleStats(active).map((s) => (
          <Stat
            key={s.label}
            {...s}
            value={s.label === 'Registros activos' ? String(rows.length) : s.value}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold">Listado de {active.toLowerCase()}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {cargando ? 'Sincronizando con base de datos...' : `${rows.length} registros en Supabase`}
            </p>
          </div>
          <ActionButton
            icon={Download}
            onClick={() => notify(`Listado de ${active} exportado correctamente`)}
          >
            Exportar
          </ActionButton>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {config.columns.map((column) => (
                  <th className="px-5 py-3" key={column}>
                    {column}
                  </th>
                ))}
                <th className="px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={config.columns.length + 1} className="py-12 text-center text-xs text-slate-400">
                    Cargando datos desde Supabase...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={config.columns.length + 1} className="py-12 text-center text-xs text-slate-400">
                    No hay registros en la base de datos para este módulo. Haz clic en "{config.action}" para agregar el primero.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr className="border-b border-slate-50 text-xs last:border-0 hover:bg-slate-50/60" key={`${row[0]}-${i}`}>
                    {row.map((cell, j) => (
                      <td className="px-5 py-4 text-slate-600" key={`${cell}-${j}`}>
                        {j === row.length - 1 ? <Status text={cell} /> : cell}
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      <RowActions
                        onView={() => openModal(`Detalle: ${row[0]}`)}
                        onEdit={() => openModal(`Editar: ${row[0]}`)}
                        onAction={() => notify(`${row[0]} actualizado`)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
