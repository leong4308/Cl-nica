import { KeyRound, LifeBuoy, LogOut, Settings, User, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const fechaEncabezado = 'Martes, 24 de septiembre de 2024'

export const saludoEncabezado = 'Buenos días'

export type OpcionMenu = { etiqueta: string; icono: LucideIcon; modal: string }

export const opcionesMenuUsuario: OpcionMenu[] = [
  { etiqueta: 'Mi perfil', icono: User, modal: 'Perfil' },
  { etiqueta: 'Configuración', icono: Settings, modal: 'Configuración' },
  { etiqueta: 'Cambiar contraseña', icono: KeyRound, modal: 'Cambiar contraseña' },
  { etiqueta: 'Preferencias', icono: Wrench, modal: 'Preferencias' },
  { etiqueta: 'Ayuda y soporte', icono: LifeBuoy, modal: 'Ayuda' },
]

export const opcionCerrarSesion: { etiqueta: string; icono: LucideIcon } = { etiqueta: 'Cerrar sesión', icono: LogOut }