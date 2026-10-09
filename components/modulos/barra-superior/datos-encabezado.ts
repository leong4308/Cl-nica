import { KeyRound, LifeBuoy, LogOut, Settings, User, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function fechaEncabezado(ahora: Date): string {
  return ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function saludoEncabezado(ahora: Date): string {
  const hora = ahora.getHours()
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export type OpcionMenu = { etiqueta: string; icono: LucideIcon; modal: string }

export const opcionesMenuUsuario: OpcionMenu[] = [
  { etiqueta: 'Mi perfil', icono: User, modal: 'Perfil' },
  { etiqueta: 'Configuración', icono: Settings, modal: 'Configuración' },
  { etiqueta: 'Cambiar contraseña', icono: KeyRound, modal: 'Cambiar contraseña' },
  { etiqueta: 'Preferencias', icono: Wrench, modal: 'Preferencias' },
  { etiqueta: 'Ayuda y soporte', icono: LifeBuoy, modal: 'Ayuda' },
]

export const opcionCerrarSesion: { etiqueta: string; icono: LucideIcon } = { etiqueta: 'Cerrar sesión', icono: LogOut }