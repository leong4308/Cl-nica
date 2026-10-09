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
}

export function ModalMarco({ title, onClose, children, footer, aviso }: PropsModalMarco) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="modal-title" className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">{children}</div>

        {footer}
        {aviso}
      </div>
    </div>
  )
}
