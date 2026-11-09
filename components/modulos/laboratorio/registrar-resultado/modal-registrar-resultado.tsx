'use client'

import { useEffect, useState } from 'react'
import { ModalMarco } from '../../compartidos/modal-marco'
import {
  cargarLaboratorio,
  registrarResultadoLaboratorio,
  marcarLaboratorioEnProceso,
} from '@/lib/supabase/datos'
import { AlertCircle, CheckCircle2, Clock, FileText, FlaskConical, Loader2, Search } from 'lucide-react'

type PropsModalRegistrarResultado = {
  solicitudIdInicial?: number
  onClose: () => void
  onSave?: (mensaje: string) => void
}

export function ModalRegistrarResultado({
  solicitudIdInicial,
  onClose,
  onSave,
}: PropsModalRegistrarResultado) {
  const [solicitudes, setSolicitudes] = useState<
    { id: number; codigo: string; orden: string; estudio: string; fecha: string; estado: string }[]
  >([])
  const [todasSolicitudes, setTodasSolicitudes] = useState<
    { id: number; codigo: string; orden: string; estudio: string; fecha: string; estado: string }[]
  >([])
  const [solicitudId, setSolicitudId] = useState<number | ''>(solicitudIdInicial ?? '')
  const [resultado, setResultado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [mostrarTodas, setMostrarTodas] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const campo = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [pasandoAProceso, setPasandoAProceso] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    cargarLaboratorio().then((res) => {
      if (!vigente) return
      const mapped = res.filas.map((f) => ({
        id: Number(f[5] || f[0].replace('LAB-', '')),
        codigo: f[0],
        orden: f[1],
        estudio: f[2],
        fecha: f[3],
        estado: (f[4] || 'solicitado').toLowerCase(),
      }))
      setTodasSolicitudes(mapped)

      // Filtrar pendientes: 'solicitado' o 'en proceso'
      const pendientes = mapped.filter((m) => m.estado !== 'completado')
      setSolicitudes(pendientes)

      if (solicitudIdInicial) {
        setSolicitudId(solicitudIdInicial)
        setMostrarTodas(mapped.some((s) => s.id === solicitudIdInicial && s.estado === 'completado'))
      } else if (pendientes.length > 0) {
        setSolicitudId(pendientes[0].id)
      }

      if (res.error) setError(res.error)
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [solicitudIdInicial])

  const listaOpciones = mostrarTodas ? todasSolicitudes : solicitudes
  const solicitudSeleccionada = todasSolicitudes.find((s) => s.id === Number(solicitudId))
  const consulta = busqueda.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const opcionesFiltradas = listaOpciones.filter((s) =>
    `${s.codigo} ${s.orden} ${s.estudio}`.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(consulta)
  )
  const ocupado = guardando || pasandoAProceso

  const handleMarcarEnProceso = async () => {
    if (!solicitudId || ocupado) return
    setPasandoAProceso(true)
    setError(null)
    const res = await marcarLaboratorioEnProceso(Number(solicitudId))
    setPasandoAProceso(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setTodasSolicitudes((prev) =>
      prev.map((s) => (s.id === Number(solicitudId) ? { ...s, estado: 'en proceso' } : s))
    )
    setSolicitudes((prev) =>
      prev.map((s) => (s.id === Number(solicitudId) ? { ...s, estado: 'en proceso' } : s))
    )
    if (onSave) onSave('Muestra ' + (solicitudSeleccionada?.codigo ?? '') + ' en proceso')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (ocupado) return
    if (!solicitudSeleccionada) {
      setError('Selecciona un analisis o muestra para capturar el resultado.')
      return
    }
    if (!resultado.trim()) {
      setError('El reporte o valores del resultado son obligatorios.')
      return
    }

    setGuardando(true)
    setError(null)

    const res = await registrarResultadoLaboratorio(
      Number(solicitudId),
      resultado.trim(),
      observaciones.trim() || undefined,
      'completado',
    )

    setGuardando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (onSave) onSave('Resultado de ' + (solicitudSeleccionada?.estudio ?? 'laboratorio') + ' completado y validado')
    onClose()
  }

  const renderBadge = (estado: string) => {
    if (estado === 'completado') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
          <CheckCircle2 size={12} className="text-emerald-600" /> Completado
        </span>
      )
    }
    if (estado === 'en proceso') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
          <Clock size={12} className="text-blue-600" /> En proceso
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200/60">
          <FlaskConical size={12} className="text-amber-600" /> Solicitado
        </span>
    )
  }

  return (
    <ModalMarco
      title="Registrar resultado de laboratorio"
      ancho="max-w-5xl"
      onClose={() => { if (!ocupado) onClose() }}
      footer={
        <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 size={16} className="shrink-0 text-blue-600" />
            Al guardar, el estudio quedará como completado.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} disabled={ocupado}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-blue-600 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" form="form-registrar-resultado"
              disabled={ocupado || cargando || !solicitudSeleccionada || !resultado.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
              {guardando ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              {guardando ? 'Guardando...' : 'Guardar y completar'}
            </button>
          </div>
        </div>
      }
    >
      <p className="-mt-2 text-sm leading-relaxed text-slate-500">Elige una solicitud, captura los hallazgos y revisa la información antes de guardar.</p>
      <form id="form-registrar-resultado" onSubmit={handleSubmit}>
        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        {cargando ? (
          <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-500">
            <Loader2 size={28} className="animate-spin text-blue-600" /> Cargando solicitudes de laboratorio...
          </div>
        ) : (
          <fieldset disabled={ocupado} className="grid min-w-0 gap-6 disabled:opacity-70 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
            <legend className="sr-only">Captura del resultado de laboratorio</legend>
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5" aria-labelledby="solicitud-heading">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">1</span>
                <div><h4 id="solicitud-heading" className="text-sm font-semibold text-slate-900">Selecciona la solicitud</h4><p className="mt-0.5 text-xs text-slate-500">Busca el estudio que vas a reportar.</p></div>
              </div>
              <label className="relative block">
                <span className="sr-only">Buscar solicitud por folio, orden o estudio</span>
                <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
                <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar folio, orden o estudio" className={campo + ' pl-10'} />
              </label>
              <label className="my-4 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={mostrarTodas} className="h-4 w-4 accent-blue-600" onChange={(e) => {
                  setMostrarTodas(e.target.checked)
                  if (!e.target.checked && solicitudSeleccionada?.estado === 'completado') setSolicitudId('')
                }} />
                Incluir solicitudes completadas
              </label>
              <div role="radiogroup" aria-label="Solicitudes de laboratorio" className="max-h-56 space-y-2 overflow-y-auto p-1 md:max-h-72">
                {opcionesFiltradas.map((s) => (
                  <label key={s.id} className={'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-blue-500 ' + (solicitudId === s.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300')}>
                    <input type="radio" name="solicitud-laboratorio" value={s.id} checked={solicitudId === s.id} onChange={() => setSolicitudId(s.id)} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{s.estudio}</span>
                      <span className="mb-2 mt-1 block text-xs text-slate-500">{s.codigo} · {s.orden}</span>
                      {renderBadge(s.estado)}
                    </span>
                  </label>
                ))}
                {opcionesFiltradas.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center">
                    <FlaskConical size={24} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">{listaOpciones.length === 0 ? 'No hay solicitudes pendientes' : 'No encontramos coincidencias'}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{listaOpciones.length === 0 ? 'Activa la opción de incluir completadas para consultar todas las solicitudes.' : 'Prueba con otro folio, orden o nombre de estudio.'}</p>
                  </div>
                )}
              </div>
              {solicitudSeleccionada && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">SOLICITUD SELECCIONADA</p>
                  <p className="break-words text-sm font-semibold text-slate-800">{solicitudSeleccionada.estudio}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-slate-500">Folio</dt><dd className="mt-1 font-medium text-slate-700">{solicitudSeleccionada.codigo}</dd></div>
                    <div><dt className="text-slate-500">Orden</dt><dd className="mt-1 font-medium text-slate-700">{solicitudSeleccionada.orden}</dd></div>
                    <div className="col-span-2"><dt className="text-slate-500">Fecha de solicitud</dt><dd className="mt-1 font-medium text-slate-700">{solicitudSeleccionada.fecha}</dd></div>
                  </dl>
                  {solicitudSeleccionada.estado === 'solicitado' && (
                    <button type="button" onClick={handleMarcarEnProceso} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                      {pasandoAProceso ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                      Marcar en proceso
                    </button>
                  )}
                </div>
              )}
            </section>
            <section className="min-w-0 py-1" aria-labelledby="resultado-heading">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">2</span>
                <div><h4 id="resultado-heading" className="text-sm font-semibold text-slate-900">Captura el resultado</h4><p className="mt-0.5 text-xs text-slate-500">Escribe con el detalle que necesites.</p></div>
              </div>
              {solicitudSeleccionada?.estado === 'completado' && (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">Esta solicitud ya está completada. Al guardar, reemplazarás su resultado y sus observaciones actuales.</p>
              )}
              <label htmlFor="resultado-laboratorio" className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FileText size={16} className="text-blue-600" /> Resultado e interpretación <span className="text-blue-600" aria-hidden="true">*</span></label>
              <p id="ayuda-resultado" className="mb-3 mt-2 text-xs leading-relaxed text-slate-500">Incluye los valores, sus unidades, los rangos de referencia y la conclusión del estudio, según corresponda.</p>
              <textarea id="resultado-laboratorio" aria-describedby="ayuda-resultado" className={campo + ' min-h-56 resize-y leading-relaxed'} placeholder="Escribe aquí los hallazgos del estudio y su interpretación..." value={resultado} onChange={(e) => setResultado(e.target.value)} required />
              <div className="mb-5 mt-1 flex justify-between text-xs text-slate-400"><span>Campo obligatorio</span><span>{resultado.length.toLocaleString('es-MX')} caracteres</span></div>
              <label htmlFor="observaciones-laboratorio" className="text-sm font-semibold text-slate-800">Observaciones técnicas <span className="font-normal text-slate-400">(opcional)</span></label>
              <p id="ayuda-observaciones" className="mb-3 mt-2 text-xs text-slate-500">Añade detalles sobre la muestra o el procesamiento.</p>
              <textarea id="observaciones-laboratorio" aria-describedby="ayuda-observaciones" rows={3} className={campo + ' resize-y leading-relaxed'} placeholder="Ej. Condiciones de la muestra o método utilizado." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </section>
          </fieldset>
        )}
      </form>
    </ModalMarco>
  )
}
