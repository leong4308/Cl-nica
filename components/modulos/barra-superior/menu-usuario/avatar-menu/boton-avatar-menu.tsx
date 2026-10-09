import { ChevronDown } from 'lucide-react'

export function BotonAvatarMenu({
  nombre, abierto, onAlternar,
}: {
  nombre: string
  abierto: boolean
  onAlternar: () => void
}) {
  const iniciales = (valor: string) => valor.split(' ').filter(Boolean).slice(0, 2).map((palabra) => palabra[0]?.toUpperCase() ?? '').join('') || 'US'
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-haspopup="menu"
      aria-expanded={abierto}
      aria-label="Menú de usuario"
      className="flex items-center gap-2"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{iniciales(nombre)}</span>
      <ChevronDown size={15} className={`text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
    </button>
  )
}
