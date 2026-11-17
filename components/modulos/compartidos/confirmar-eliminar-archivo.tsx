'use client'
import { createPortal } from 'react-dom'
import { useRef, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { ModalMarco } from './modal-marco'
import { AvisoClinico, BOTON_SECUNDARIO, CAMPO_CLINICO } from './editor-clinico'
export function ConfirmarEliminarArchivo({ nombre, onClose, onEliminar }: { nombre: string; onClose: () => void; onEliminar: (motivo: string) => Promise<string | null> }) {
  const [motivo, setMotivo] = useState(''), [confirmar, setConfirmar] = useState(false), [ocupado, setOcupado] = useState(false), [error, setError] = useState<string | null>(null)
  const enviando = useRef(false)
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); e.stopPropagation(); if (!confirmar || enviando.current) return
    enviando.current = true; setOcupado(true); setError(null)
    try { const mensaje = await onEliminar(motivo); if (mensaje) setError(mensaje); else onClose() }
    catch { setError('No se pudo eliminar el PDF. Comprueba su estado antes de reintentar.') }
    finally { enviando.current = false; setOcupado(false) }
  }
  if (typeof document === 'undefined') return null
  return createPortal(<ModalMarco title="Eliminar archivo PDF" ancho="max-w-xl" onClose={() => { if (!ocupado) onClose() }} footer={<div className="flex justify-between gap-3"><button type="button" disabled={ocupado} className={BOTON_SECUNDARIO} onClick={onClose}>Cancelar</button><button type="submit" form="eliminar-archivo-pdf" disabled={ocupado || !confirmar || motivo.trim().length < 10} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={16} />{ocupado ? 'Eliminando...' : 'Eliminar PDF'}</button></div>}>
    <div role="alert" className="mb-5 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle size={24} className="shrink-0" /><div><p className="font-semibold">Vas a eliminar el archivo «{nombre}».</p><p className="mt-2">Dejará de estar disponible en este registro y en el portal del paciente. Se conservará una copia privada y la operación quedará registrada con tu identidad y el motivo.</p></div></div>
    <AvisoClinico mensaje={error} /><form id="eliminar-archivo-pdf" onSubmit={guardar} className="space-y-4"><label className="block text-sm font-medium">Motivo de eliminación<textarea required minLength={10} maxLength={1000} rows={3} disabled={ocupado} value={motivo} onChange={e => setMotivo(e.target.value)} className={CAMPO_CLINICO} /></label><label className="flex gap-3 text-sm"><input type="checkbox" disabled={ocupado} checked={confirmar} onChange={e => setConfirmar(e.target.checked)} className="mt-1" />Confirmo que revisé el nombre y deseo eliminar este PDF.</label></form>
  </ModalMarco>, document.body)
}
