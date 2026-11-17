'use client'
import { useId } from 'react'
import { TriangleAlert } from 'lucide-react'
import { ModalMarco } from './modal-marco'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from './editor-clinico'

export type ConfirmacionClinicaDatos = { titulo: string; mensaje: string; confirmar: string; accion: () => void; tono?: 'peligro' | 'primario' }

export function ConfirmacionClinica({ titulo, mensaje, confirmar, onConfirmar, onCancelar, tono = 'peligro' }: { titulo: string; mensaje: string; confirmar: string; onConfirmar: () => void; onCancelar: () => void; tono?: 'peligro' | 'primario' }) {
  const descripcionId = useId()
  return <ModalMarco title={titulo} onClose={onCancelar} role="alertdialog" descripcionId={descripcionId}>
    <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><TriangleAlert size={23} /></span><p id={descripcionId} className="text-sm leading-relaxed text-slate-600">{mensaje}</p></div>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><button autoFocus type="button" className={BOTON_SECUNDARIO} onClick={onCancelar}>Cancelar</button><button type="button" className={tono === 'primario' ? BOTON_PRIMARIO : 'rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600'} onClick={onConfirmar}>{confirmar}</button></div>
  </ModalMarco>
}
