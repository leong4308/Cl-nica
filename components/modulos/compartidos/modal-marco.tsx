'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export const CAMPO = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
export const ETIQUETA = 'text-sm font-medium'

type PropsModalMarco = {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  aviso?: ReactNode
  avisoEnLinea?: boolean
  ancho?: string
  contenidoFijo?: boolean
  role?: 'dialog' | 'alertdialog'
  descripcionId?: string
}

const abiertos: HTMLDialogElement[] = []
let overflowAnterior = '', paddingAnterior = ''

export function ModalMarco({ title, onClose, children, footer, aviso, avisoEnLinea = false, ancho = 'max-w-md', contenidoFijo = false, role = 'dialog', descripcionId }: PropsModalMarco) {
  const dialogo = useRef<HTMLDialogElement>(null), tituloId = useId()
  useEffect(() => {
    const nodo = dialogo.current
    if (!nodo) return
    const focoAnterior = document.activeElement as HTMLElement | null
    if (!abiertos.length) {
      overflowAnterior = document.body.style.overflow; paddingAnterior = document.body.style.paddingRight
      const barra = window.innerWidth - document.documentElement.clientWidth
      if (barra > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + barra}px`
      document.body.style.overflow = 'hidden'
    }
    let focoSuspendido: HTMLElement | null = null
    const sincronizarBloqueo = () => {
      // El bloqueo de sesión debe quedar por encima de los diálogos sin desmontar
      // sus formularios. Los diálogos nativos escapan a la inercia de sus ancestros.
      if (nodo.closest('[inert]')) {
        if (nodo.open) { focoSuspendido = nodo.contains(document.activeElement) ? document.activeElement as HTMLElement : null; nodo.close() }
        document.querySelector<HTMLElement>('[aria-labelledby="titulo-bloqueo"] input')?.focus({ preventScroll: true })
      } else if (nodo.isConnected && !nodo.open) {
        nodo.showModal()
        if (focoSuspendido?.isConnected) focoSuspendido.focus({ preventScroll: true })
      }
    }
    abiertos.push(nodo); sincronizarBloqueo()
    const observador = new MutationObserver(sincronizarBloqueo)
    observador.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['inert'] })
    return () => {
      observador.disconnect()
      const indice = abiertos.indexOf(nodo)
      if (indice >= 0) abiertos.splice(indice, 1)
      nodo.close()
      const superior = abiertos.at(-1)
      if (!superior) { document.body.style.overflow = overflowAnterior; document.body.style.paddingRight = paddingAnterior }
      if (focoAnterior?.isConnected && (!superior || superior.contains(focoAnterior))) focoAnterior.focus({ preventScroll: true })
      else superior?.querySelector<HTMLElement>('button, input, textarea, select, [tabindex="0"]')?.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={dialogo}
      className="fixed inset-0 m-0 hidden h-dvh max-h-none w-screen max-w-none items-center justify-center overflow-hidden border-0 bg-transparent p-4 text-inherit backdrop:bg-slate-950/40 open:flex"
      role={role}
      aria-modal="true"
      aria-labelledby={tituloId}
      aria-describedby={descripcionId}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
      onKeyDown={event => {
        const nodo = dialogo.current
        if (event.key !== 'Tab' || !nodo || abiertos.filter(d => d.open).at(-1) !== nodo) return
        const elementos = [...nodo.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), textarea, select, [tabindex]')].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0)
        const primero = elementos[0], ultimo = elementos.at(-1), foco = document.activeElement
        if (!primero) { event.preventDefault(); nodo.focus(); return }
        if (event.shiftKey && (foco === primero || !nodo.contains(foco))) { event.preventDefault(); ultimo?.focus() }
        else if (!event.shiftKey && (foco === ultimo || !nodo.contains(foco))) { event.preventDefault(); primero.focus() }
      }}
    >
      <div
        className={`max-h-[90dvh] w-full ${ancho} rounded-2xl bg-white shadow-2xl ${contenidoFijo ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-6'}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={`flex shrink-0 items-center justify-between gap-3 ${contenidoFijo ? 'px-5 py-5 sm:px-6' : ''}`}>
          <h3 id={tituloId} className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {avisoEnLinea && aviso && <div className="flex shrink-0 justify-end px-5 pb-3 sm:px-6">{aviso}</div>}
        <div className={contenidoFijo ? 'min-h-0 overflow-y-auto px-5 pb-5 sm:px-6' : 'mt-5 flex flex-col gap-3'}>{children}</div>

        {contenidoFijo ? <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">{footer}{!avisoEnLinea && aviso}</div> : <>{footer}{!avisoEnLinea && aviso}</>}
      </div>
    </dialog>
  )
}
