'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Download, Filter, Loader2, Plus } from 'lucide-react'
import { modules } from '../compartidos/data'
import type { ClinicActions, Row } from '../compartidos/types'
import { ActionButton, RowActions, Stat, Status } from '../compartidos/ui'
import { cargarModulo } from '@/lib/supabase/datos'

export function ModulePage({ active, notify, openModal }: ClinicActions & { active: string }) {
  const [filas, setFilas] = useState<Row[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const config = modules[active]

  // Vuelve a leer el módulo activo. Se dispara al cambiar de pestaña y cada vez
  // que se guarda algo (por ejemplo una cita nueva) para ver el dato real.
  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    cargarModulo(active).then((resultado) => {
      if (!vigente) return
      setFilas(resultado.filas)
      setError(resultado.error)
      setCargando(false)
    })
    return () => { vigente = false }
  }, [active, version])

  useEffect(() => {
    function alGuardar() { setVersion((v) => v + 1) }
    window.addEventListener('datos-actualizados', alGuardar)
    return () => window.removeEventListener('datos-actualizados', alGuardar)
  }, [])

  if (!config) return null
  const Icon = config.icon

  return (
    <section>
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600"><Icon size={17} />{config.eyebrow}</p>
          <h2 className="text-[27px] font-bold tracking-tight">{config.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
        <div className="flex gap-2">
          <ActionButton icon={Filter} onClick={() => openModal(`Filtros de ${active}`)}>Filtrar</ActionButton>
          <ActionButton primary icon={Plus} onClick={() => openModal(config.action)}>{config.action}</ActionButton>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat icon={Icon} label="Registros totales" value={cargando ? '—' : String(filas.length)} meta="Desde Supabase" tone="blue" />
        <Stat icon={Icon} label="Estado de conexión" value={error ? 'Error' : 'Activo'} meta={error ? 'Revisa tus políticas RLS' : 'Consulta en vivo'} tone={error ? 'orange' : 'green'} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold">Listado de {active.toLowerCase()}</h3>
            <p className="mt-0.5 text-xs text-slate-400">Todos los registros del sistema</p>
          </div>
          <ActionButton icon={Download} onClick={() => notify(`Listado de ${active} exportado`)}>Exportar</ActionButton>
        </div>

        {cargando && <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" /> Consultando Supabase...</div>}

        {!cargando && error && <div className="flex flex-col items-center gap-2 px-5 py-16 text-center"><AlertCircle size={22} className="text-amber-500" /><p className="text-sm font-semibold text-slate-700">No se pudieron cargar los datos</p><p className="max-w-md text-xs text-slate-400">{error}</p></div>}

        {!cargando && !error && filas.length === 0 && <div className="px-5 py-16 text-center text-sm text-slate-400">No hay registros en la base de datos.</div>}

        {!cargando && !error && filas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead><tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">{config.columns.map((column) => <th className="px-5 py-3" key={column}>{column}</th>)}<th className="px-5 py-3">Acciones</th></tr></thead>
              <tbody>
                {filas.map((row, i) => <tr className="border-b border-slate-50 text-xs last:border-0" key={`${row[0]}-${i}`}>{row.map((cell, j) => <td className="px-5 py-4 text-slate-600" key={`${cell}-${j}`}>{j === row.length - 1 ? <Status text={cell} /> : cell}</td>)}<td className="px-5 py-3"><RowActions onView={() => openModal(`Detalle: ${row[0]}`)} onEdit={() => openModal(`Editar: ${row[0]}`)} /></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
