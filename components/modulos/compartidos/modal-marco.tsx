'use client'

import { type ReactNode } from 'react'
import { X } from 'lucide-react'

export const CAMPO = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
export const ETIQUETA = 'text-sm font-medium'

type PropsModalMarco = {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  aviso?: ReactNode
  ancho?: string
  contenidoFijo?: boolean
}

export function ModalMarco({ title, onClose, children, footer, aviso, ancho = 'max-w-md', contenidoFijo = false }: PropsModalMarco) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={onClose}
    >
      <div
        className={`max-h-[90dvh] w-full ${ancho} rounded-2xl bg-white shadow-2xl ${contenidoFijo ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-6'}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={`flex shrink-0 items-center justify-between gap-3 ${contenidoFijo ? 'px-5 py-5 sm:px-6' : ''}`}>
          <h3 id="modal-title" className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={contenidoFijo ? 'min-h-0 overflow-y-auto px-5 pb-5 sm:px-6' : 'mt-5 flex flex-col gap-3'}>{children}</div>

        {contenidoFijo ? <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">{footer}{aviso}</div> : <>{footer}{aviso}</>}
      </div>
    </div>
  )
}
