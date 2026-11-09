'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, X } from 'lucide-react'
import { validarDocumentoClinico, type TipoDocumentoClinico } from '@/lib/documentos-clinicos'
import { PanelClinico } from './editor-clinico'

type Adjunto = { nombre: string; href: string }
export function DocumentosClinicos({ tipo, registroId, archivo, onArchivo, disabled, soloLectura, onValidando }: {
  tipo: TipoDocumentoClinico; registroId?: number; archivo?: File
  onArchivo?: (archivo?: File) => void; disabled?: boolean; soloLectura?: boolean; onValidando?: (estado: boolean) => void
}) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!registroId) return
    const controller = new AbortController()
    setCargando(true)
    setAdjuntos([])
    fetch(`/api/documentos-clinicos/${tipo}/${registroId}`, { signal: controller.signal })
      .then(async (res) => { const datos = await res.json(); if (!res.ok) throw Error(datos.error || 'No se pudieron consultar los PDF.'); return datos })
      .then((datos) => setAdjuntos(datos.archivos ?? []))
      .catch((err) => { if (!controller.signal.aborted) setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setCargando(false) })
    return () => controller.abort()
  }, [tipo, registroId])
  return <PanelClinico icon={Paperclip} titulo="Documentos PDF" ayuda={soloLectura ? 'Documentos vinculados a este registro.' : 'Adjunta un PDF de hasta 2 MB. Los documentos anteriores se conservan.'} suave>
    {cargando && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Consultando documentos...</p>}
    {adjuntos.length > 0 && <ul className="mb-4 space-y-2">{adjuntos.map((adjunto) => <li key={adjunto.href}><a href={adjunto.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-blue-600 hover:border-blue-300 hover:bg-blue-50"><FileText size={17} className="shrink-0" /><span className="break-all">{adjunto.nombre}</span><span className="ml-auto shrink-0 text-xs">Abrir ↗</span></a></li>)}</ul>}
    {!cargando && !adjuntos.length && !error && registroId && <p className="mb-3 text-sm text-slate-500">Sin documentos adjuntos.</p>}
    {error && <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p>}
    {!soloLectura && <>
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-slate-700">Seleccionar PDF (máximo 2 MB)</label>
      <input ref={input} id={inputId} type="file" accept="application/pdf,.pdf" disabled={disabled} className="block w-full min-w-0 text-xs text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2.5 file:font-semibold file:text-blue-700 disabled:opacity-50" onChange={async (event) => {
        const elegido = event.currentTarget.files?.[0]
        if (!elegido) return
        onValidando?.(true)
        setError(null)
        try {
          const mensaje = await validarDocumentoClinico(elegido)
          if (mensaje) { setError(mensaje); onArchivo?.(undefined); if (input.current) input.current.value = '' }
          else onArchivo?.(elegido)
        } catch { setError('No se pudo leer el archivo. Selecciónalo de nuevo.'); onArchivo?.(undefined) }
        finally { onValidando?.(false) }
      }} />
      {archivo && <div className="mt-3 flex items-start gap-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800"><FileText size={16} className="shrink-0" /><span className="min-w-0 flex-1 break-all">{archivo.name} · {(archivo.size / 1024 / 1024).toFixed(2)} MB<br />Se adjuntará al guardar.</span><button type="button" aria-label="Quitar PDF seleccionado" disabled={disabled} onClick={() => { onArchivo?.(undefined); if (input.current) input.current.value = '' }}><X size={16} /></button></div>}
    </>}
  </PanelClinico>
}
