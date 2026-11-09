export const SECCIONES_CUENTA = ['Perfil', 'Configuración', 'Cambiar contraseña', 'Preferencias', 'Ayuda'] as const
export type SeccionCuenta = typeof SECCIONES_CUENTA[number]
export function esSeccionCuenta(valor: string): valor is SeccionCuenta {
  return (SECCIONES_CUENTA as readonly string[]).includes(valor)
}
export function abrirSeccionCuenta(valor: string): boolean {
  if (!esSeccionCuenta(valor)) return false
  window.dispatchEvent(new CustomEvent('abrir-cuenta', { detail: valor }))
  return true
}
