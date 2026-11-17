'use client'
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmarEliminarArchivo } from './confirmar-eliminar-archivo'
type Info = { puedeEliminar: boolean; archivo: string; nombre: string; version: string }
export function RetirarPdfLaboratorio({ id, onRetirado }: { id: number; onRetirado: () => void }) {
  const [info, setInfo] = useState<Info | null>(null), [confirmar, setConfirmar] = useState(false)
  useEffect(() => { const c = new AbortController(); fetch(`/api/laboratorio/${id}?metadatos=1`, { signal: c.signal, cache: 'no-store' }).then(async r => r.ok ? r.json() : null).then(b => { if (!c.signal.aborted) setInfo(b) }).catch(() => {}); return () => c.abort() }, [id])
  if (!info?.puedeEliminar || !info.archivo) return null
  return <><button type="button" className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => setConfirmar(true)}><Trash2 size={14} />Eliminar PDF adjunto</button>{confirmar && <ConfirmarEliminarArchivo nombre={info.nombre} onClose={() => setConfirmar(false)} onEliminar={async motivo => {
    const r = await fetch(`/api/laboratorio/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archivo: info.archivo, version: info.version, motivo, confirmado: true }) }), b = await r.json()
    if (!r.ok) return b.error || 'No se pudo eliminar el PDF.'
    setInfo(null); window.dispatchEvent(new Event('datos-actualizados')); onRetirado(); return null
  }} />}</>
}
