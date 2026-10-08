import type { LucideIcon } from 'lucide-react'

/**
 * Botón de opción del menú de usuario (Mi perfil, Cambiar contraseña…).
 *
 * Vive en `barra-superior/menu-usuario/opcion-menu/`: llama a
 * `onElegir(modal)`. Cada opción espera su carpeta de destino
 * (`mi-perfil/`, `cambiar-contrasena/`, `preferencias/`, `ayuda-soporte/`),
 * que hoy `openModal()` de `app/page.tsx` aún no renderiza.
 */
export function BotonOpcionMenu({
  etiqueta, Icono, modal, onElegir,
}: {
  etiqueta: string
  Icono: LucideIcon
  modal: string
  onElegir: (modal: string) => void
}) {
  return (
    <button key={etiqueta} type="button" role="menuitem" onClick={() => onElegir(modal)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
      <Icono size={16} className="shrink-0 text-slate-400" />
      {etiqueta}
    </button>
  )
}
