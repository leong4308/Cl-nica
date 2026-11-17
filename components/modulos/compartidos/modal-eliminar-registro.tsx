'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { ModalMarco } from './modal-marco'
import { AvisoClinico, BOTON_SECUNDARIO, CAMPO_CLINICO } from './editor-clinico'
type Info = { nombre: string; version: string; puedeEliminar: boolean; referencias: { tabla: string; cantidad: number }[] }
export function ModalEliminarRegistro({ modulo, id, onClose, onEliminado }: { modulo: string; id: number; onClose: () => void; onEliminado: (mensaje: string) => void }) {
  const [info, setInfo] = useState<Info | null>(null), [error, setError] = useState<string | null>(null), [motivo, setMotivo] = useState(''), [confirmado, setConfirmado] = useState(false), [ocupado, setOcupado] = useState(false)
  const enviando = useRef(false)
  const cargar = useCallback(async (signal?: AbortSignal) => {
    try { const r = await fetch(`/api/admin/eliminaciones?modulo=${encodeURIComponent(modulo)}&id=${id}`, { cache: 'no-store', signal }), b = await r.json(); if (!r.ok) throw Error(b.error); if (!signal?.aborted) { setInfo(b); setConfirmado(false); setError(null) } }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'No se pudo revisar el registro.') }
  }, [modulo, id])
  useEffect(() => { const c = new AbortController(); void cargar(c.signal); return () => c.abort() }, [cargar])
  async function eliminar(e: React.FormEvent) {
    e.preventDefault(); if (!info || !info.puedeEliminar || !confirmado || enviando.current) return
    enviando.current = true; setOcupado(true); setError(null)
    try {
      const r = await fetch('/api/admin/eliminaciones', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modulo, id, version: info.version, motivo, confirmado }) }), b = await r.json()
      if (!r.ok) { if (r.status === 409) setConfirmado(false); throw Error(b.error) }
      window.dispatchEvent(new Event('datos-actualizados')); window.dispatchEvent(new Event('cita-creada')); onEliminado(b.mensaje); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar. Revisa tu conexión.') }
    finally { enviando.current = false; setOcupado(false) }
  }
  return <ModalMarco title="Eliminar registro" ancho="max-w-xl" onClose={() => { if (!ocupado) onClose() }} footer={<div className="flex justify-between gap-3"><button type="button" className={BOTON_SECUNDARIO} disabled={ocupado} onClick={onClose}>Cancelar</button><button form="confirmar-eliminacion-admin" type="submit" disabled={ocupado || !info?.puedeEliminar || !confirmado || motivo.trim().length < 10} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={16} />{ocupado ? 'Eliminando...' : 'Eliminar registro'}</button></div>}>
    <div role="alert" className="mb-5 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle size={23} className="shrink-0" /><div><p className="font-semibold">Vas a eliminar {info?.nombre || `${modulo} #${id}`}.</p><p className="mt-2">Esta acción retira el registro del sistema y no se puede deshacer desde esta pantalla. Se guardarán el motivo y tu identidad en el historial de cambios.</p>{modulo === 'Pacientes' && <p className="mt-2">La cuenta vinculada del paciente quedará desactivada.</p>}</div></div>
    <AvisoClinico mensaje={error} />
    {info && !info.puedeEliminar && <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Este registro tiene información relacionada.</p><p className="mt-2">No se borrarán historias ni otros registros automáticamente.</p><ul className="mt-3 list-inside list-disc">{info.referencias.map((r, i) => <li key={i}>{r.tabla.replaceAll('_', ' ')}: {r.cantidad}</li>)}</ul></section>}
    <form id="confirmar-eliminacion-admin" onSubmit={eliminar} className="space-y-4"><label className="block text-sm font-medium">Motivo de eliminación<textarea required minLength={10} maxLength={1000} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={ocupado} className={CAMPO_CLINICO} placeholder="Explica por qué debe eliminarse este registro." /></label><label className="flex gap-3 text-sm"><input type="checkbox" checked={confirmado} disabled={ocupado || !info?.puedeEliminar} onChange={e => setConfirmado(e.target.checked)} className="mt-1" />Revisé el registro seleccionado y confirmo que deseo eliminarlo.</label></form>
    {error && <button type="button" disabled={ocupado} className={BOTON_SECUNDARIO + ' mt-4'} onClick={() => void cargar()}><RefreshCw size={15} />Volver a revisar el registro</button>}
  </ModalMarco>
}
