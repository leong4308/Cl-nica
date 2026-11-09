'use client'

import { useEffect, useRef, useState } from 'react'
import { ModalMarco } from '../../compartidos/modal-marco'
import { nombrePdf, validarPdf } from '@/lib/laboratorio/archivo-pdf'
import {
  cargarLaboratorio,
  registrarResultadoLaboratorio,
  marcarLaboratorioEnProceso,
} from '@/lib/supabase/datos'
import { AlertCircle, CheckCircle2, Clock, FileText, FlaskConical, Loader2, Search } from 'lucide-react'

type PropsModalRegistrarResultado = {
  solicitudIdInicial?: number
  modo?: 'registrar' | 'ver' | 'editar'
  onClose: () => void
  onSave?: (mensaje: string) => void
}

type SolicitudLaboratorio = {
  id: number; codigo: string; orden: string; estudio: string; fecha: string; estado: string
  resultado: string; observaciones: string; archivo: string; fechaResultado: string
}

export function ModalRegistrarResultado({
  solicitudIdInicial,
  modo = 'registrar',
  onClose,
  onSave,
}: PropsModalRegistrarResultado) {
  const [todasSolicitudes, setTodasSolicitudes] = useState<SolicitudLaboratorio[]>([])
  const [solicitudId, setSolicitudId] = useState<number | ''>(solicitudIdInicial ?? '')
  const [resultado, setResultado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [mostrarTodas, setMostrarTodas] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [archivo, setArchivo] = useState<File | undefined>()
  const inputArchivo = useRef<HTMLInputElement>(null)
  const [validandoArchivo, setValidandoArchivo] = useState(false)
  const [confirmarCompletado, setConfirmarCompletado] = useState(false)
  const soloLectura = modo === 'ver'
  const solicitudFija = modo !== 'registrar'
  const campo = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [pasandoAProceso, setPasandoAProceso] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    cargarLaboratorio(solicitudIdInicial).then((res) => {
      if (!vigente) return
      const mapped = res.filas.map((f) => ({
        id: Number(f[5] || f[0].replace('LAB-', '')),
        codigo: f[0],
        orden: f[1],
        estudio: f[2],
        fecha: f[3],
        estado: (f[4] || 'solicitado').toLowerCase(),
        resultado: f[6] || '',
        observaciones: f[7] || '',
        archivo: f[8] || '',
        fechaResultado: f[9] || '',
      }))
      setTodasSolicitudes(mapped)

      // Filtrar pendientes: 'solicitado' o 'en proceso'
      const pendientes = mapped.filter((m) => m.estado !== 'completado')

      if (solicitudIdInicial) {
        setSolicitudId(solicitudIdInicial)
        setMostrarTodas(mapped.some((s) => s.id === solicitudIdInicial && s.estado === 'completado'))
      } else if (pendientes.length > 0) {
        setSolicitudId(pendientes[0].id)
      }

      if (res.error) setError(res.error)
      else if (solicitudIdInicial && !mapped.length) setError('La solicitud no existe o no tienes acceso a ella.')
      setCargando(false)
    }).catch(() => {
      if (!vigente) return
      setError('No se pudieron cargar los resultados. Cierra la ventana e inténtalo de nuevo.')
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [solicitudIdInicial])

  const listaOpciones = mostrarTodas ? todasSolicitudes : todasSolicitudes.filter((s) => s.estado !== 'completado')
  const solicitudSeleccionada = todasSolicitudes.find((s) => s.id === Number(solicitudId))
  const contenidoResultado = solicitudSeleccionada?.resultado ?? ''
  const contenidoObservaciones = solicitudSeleccionada?.observaciones ?? ''
  useEffect(() => {
    setResultado(contenidoResultado)
    setObservaciones(contenidoObservaciones)
    setArchivo(undefined)
    if (inputArchivo.current) inputArchivo.current.value = ''
    setConfirmarCompletado(false)
  }, [solicitudId, contenidoResultado, contenidoObservaciones])
  const consulta = busqueda.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const opcionesFiltradas = listaOpciones.filter((s) =>
    `${s.codigo} ${s.orden} ${s.estudio}`.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(consulta)
  )
  const ocupado = guardando || pasandoAProceso || validandoArchivo
  const tieneResultado = Boolean(resultado.trim() || archivo || solicitudSeleccionada?.archivo)
  const necesitaConfirmacion = solicitudSeleccionada?.estado === 'completado'

  const handleMarcarEnProceso = async () => {
    if (!solicitudId || ocupado || soloLectura) return
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
    if (onSave) onSave('Muestra ' + (solicitudSeleccionada?.codigo ?? '') + ' en proceso')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (ocupado || soloLectura) return
    if (!solicitudSeleccionada) {
      setError('Selecciona un analisis o muestra para capturar el resultado.')
      return
    }
    if (!tieneResultado) {
      setError('Escribe el resultado o adjunta un PDF.')
      return
    }
    if (necesitaConfirmacion && !confirmarCompletado) {
      setError('Confirma la advertencia para modificar este resultado completado.')
      return
    }

    setGuardando(true)
    setError(null)

    const res = await registrarResultadoLaboratorio(
      Number(solicitudId),
      resultado.trim(),
      observaciones.trim() || undefined,
      'completado',
      archivo,
      confirmarCompletado,
      solicitudSeleccionada.fechaResultado,
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

  if (soloLectura) {
    return (
      <ModalMarco title="Visualización de resultados" ancho="max-w-3xl" onClose={onClose}
        footer={<div className="mt-6 flex justify-end border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Cerrar</button></div>}>
        <p className="-mt-2 text-sm text-slate-500">Consulta el reporte y los documentos de este laboratorio.</p>
        {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
        {cargando ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={20} className="animate-spin" /> Cargando resultado...</p> : solicitudSeleccionada && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-base font-semibold text-slate-900">{solicitudSeleccionada.estudio}</h4>{renderBadge(solicitudSeleccionada.estado)}</div>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-slate-500">Folio</dt><dd className="mt-1 font-medium">{solicitudSeleccionada.codigo}</dd></div>
                <div><dt className="text-xs text-slate-500">Orden</dt><dd className="mt-1 font-medium">{solicitudSeleccionada.orden}</dd></div>
                <div><dt className="text-xs text-slate-500">Fecha de solicitud</dt><dd className="mt-1 font-medium">{solicitudSeleccionada.fecha}</dd></div>
              </dl>
            </div>
            <section className="py-2"><h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText size={17} className="text-blue-600" /> Resultado e interpretación</h4><p className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 p-4 text-sm leading-relaxed text-slate-700">{solicitudSeleccionada.resultado || 'Aún no se ha capturado un resultado escrito.'}</p></section>
            <section><h4 className="mb-2 text-sm font-semibold">Observaciones técnicas</h4><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{solicitudSeleccionada.observaciones || 'Sin observaciones adicionales.'}</p></section>
            <section className="mt-2 rounded-xl border border-slate-200 p-4"><h4 className="mb-2 text-sm font-semibold">Documento PDF</h4>{solicitudSeleccionada.archivo ? <a href={`/api/laboratorio/${solicitudSeleccionada.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 break-all text-sm font-medium text-blue-600 hover:underline"><FileText size={17} className="shrink-0" /> Abrir PDF: {nombrePdf(solicitudSeleccionada.archivo)}</a> : <p className="text-sm text-slate-500">No hay un PDF adjunto a este resultado.</p>}</section>
          </>
        )}
      </ModalMarco>
    )
  }

  return (
    <ModalMarco
      title={modo === 'editar' ? 'Modificar resultados' : 'Registrar resultado de laboratorio'}
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
              disabled={ocupado || cargando || !solicitudSeleccionada || !tieneResultado || (necesitaConfirmacion && !confirmarCompletado)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
              {guardando ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              {guardando ? 'Guardando...' : modo === 'editar' ? 'Guardar cambios' : 'Guardar y completar'}
            </button>
          </div>
        </div>
      }
    >
      <p className="-mt-2 text-sm leading-relaxed text-slate-500">{solicitudFija ? 'Revisa el resultado actual y modifica la información de este laboratorio.' : 'Elige una solicitud, captura los hallazgos y revisa la información antes de guardar.'}</p>
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
                <div><h4 id="solicitud-heading" className="text-sm font-semibold text-slate-900">{solicitudFija ? 'Datos del laboratorio' : 'Selecciona la solicitud'}</h4><p className="mt-0.5 text-xs text-slate-500">{solicitudFija ? 'Estás modificando este estudio.' : 'Busca el estudio que vas a reportar.'}</p></div>
              </div>
              {!solicitudFija && <>
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
              </>}
              {solicitudSeleccionada && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">SOLICITUD SELECCIONADA</p>
                  <p className="break-words text-sm font-semibold text-slate-800">{solicitudSeleccionada.estudio}</p>
                  <div className="mt-2">{renderBadge(solicitudSeleccionada.estado)}</div>
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
                <div><h4 id="resultado-heading" className="text-sm font-semibold text-slate-900">{modo === 'editar' ? 'Modifica el resultado' : 'Captura el resultado'}</h4><p className="mt-0.5 text-xs text-slate-500">Escribe con el detalle que necesites.</p></div>
              </div>
              {solicitudSeleccionada?.estado === 'completado' && (
                <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                  <p className="flex items-center gap-2 font-semibold"><AlertCircle size={18} className="shrink-0" /> Este resultado ya está completado</p>
                  <p className="mt-2 text-xs">Los cambios pueden alterar la información clínica previamente registrada: resultado, interpretación, observaciones y PDF si lo reemplazas. Revisa todos los datos antes de guardar.</p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-medium"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600" checked={confirmarCompletado} onChange={(e) => setConfirmarCompletado(e.target.checked)} /> Entiendo la advertencia y quiero modificar este resultado completado.</label>
                </div>
              )}
              <label htmlFor="resultado-laboratorio" className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FileText size={16} className="text-blue-600" /> Resultado e interpretación <span className="text-blue-600" aria-hidden="true">*</span></label>
              <p id="ayuda-resultado" className="mb-3 mt-2 text-xs leading-relaxed text-slate-500">Incluye los valores, sus unidades, los rangos de referencia y la conclusión del estudio, según corresponda.</p>
              <textarea id="resultado-laboratorio" aria-describedby="ayuda-resultado" className={campo + ' min-h-56 resize-y leading-relaxed'} placeholder="Escribe aquí los hallazgos del estudio y su interpretación..." value={resultado} onChange={(e) => setResultado(e.target.value)} required={!archivo && !solicitudSeleccionada?.archivo} />
              <div className="mb-5 mt-1 flex justify-between gap-2 text-xs text-slate-400"><span>Escribe el resultado o adjunta un PDF</span><span className="shrink-0">{resultado.length.toLocaleString('es-MX')} caracteres</span></div>
              <label htmlFor="observaciones-laboratorio" className="text-sm font-semibold text-slate-800">Observaciones técnicas <span className="font-normal text-slate-400">(opcional)</span></label>
              <p id="ayuda-observaciones" className="mb-3 mt-2 text-xs text-slate-500">Añade detalles sobre la muestra o el procesamiento.</p>
              <textarea id="observaciones-laboratorio" aria-describedby="ayuda-observaciones" rows={3} className={campo + ' resize-y leading-relaxed'} placeholder="Ej. Condiciones de la muestra o método utilizado." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <label htmlFor="pdf-laboratorio" className="text-sm font-semibold text-slate-800">Adjuntar resultado en PDF</label>
                <p id="ayuda-pdf" className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">Un PDF por estudio, máximo 10 MB. {solicitudSeleccionada?.archivo ? 'El documento actual se conservará si no eliges uno nuevo.' : 'Puedes adjuntar el informe emitido por el laboratorio.'}</p>
                {solicitudSeleccionada?.archivo && <a href={`/api/laboratorio/${solicitudSeleccionada.id}`} target="_blank" rel="noopener noreferrer" className="mb-3 block break-all text-xs font-medium text-blue-600 hover:underline">Ver PDF actual: {nombrePdf(solicitudSeleccionada.archivo)}</a>}
                <input ref={inputArchivo} id="pdf-laboratorio" type="file" accept="application/pdf,.pdf" aria-describedby="ayuda-pdf" className="block w-full min-w-0 text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-200" onChange={async (e) => {
                  const input = e.currentTarget
                  const seleccionado = input.files?.[0]
                  if (!seleccionado) return
                  setValidandoArchivo(true)
                  setError(null)
                  try {
                    const mensaje = await validarPdf(seleccionado)
                    if (mensaje) { setError(mensaje); input.value = ''; setArchivo(undefined) }
                    else setArchivo(seleccionado)
                  } catch { setError('No se pudo leer el PDF. Selecciónalo de nuevo.'); input.value = ''; setArchivo(undefined) }
                  finally { setValidandoArchivo(false) }
                }} />
                {validandoArchivo && <p role="status" className="mt-2 text-xs text-slate-500">Revisando PDF...</p>}
                {archivo && <div className="mt-3 flex items-start justify-between gap-3 text-xs"><p className="break-all text-slate-700">{archivo.name} ({(archivo.size / 1024 / 1024).toFixed(2)} MB){solicitudSeleccionada?.archivo ? ' · Reemplazará el PDF actual al guardar.' : ' · Se adjuntará al guardar.'}</p><button type="button" onClick={() => { setArchivo(undefined); if (inputArchivo.current) inputArchivo.current.value = '' }} className="shrink-0 font-medium text-blue-600 hover:underline">Quitar selección</button></div>}
              </div>
            </section>
          </fieldset>
        )}
      </form>
    </ModalMarco>
  )
}
