'use client'

import { ArrowRight } from 'lucide-react'

/**
 * Botón "Ingresar" del login.
 *
 * Vive en `login/ingresar/` porque es donde se pinta (`login-form.tsx`):
 * dispara el `handleSubmit` del formulario, no abre modal.
 */
export function BotonIngresar({ cargando }: { cargando: boolean }) {
  return (
    <button type="submit" disabled={cargando} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1a56db] font-semibold text-white transition hover:bg-[#1347bb] disabled:cursor-wait disabled:opacity-70">
      {cargando ? 'Verificando...' : 'Ingresar'}
      {!cargando && <ArrowRight size={18} />}
    </button>
  )
}
