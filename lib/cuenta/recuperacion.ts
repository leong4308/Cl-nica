export const COOKIE_RECUPERACION = 'cn-recuperacion'
export function destinoSeguro(valor: string | null): string {
  return valor && valor.startsWith('/') && !valor.startsWith('//') && !/[\\\r\n]/.test(valor) ? valor : '/'
}
export function validarNuevaContrasena(nueva: unknown, confirmacion: unknown): string | null {
  if (typeof nueva !== 'string' || nueva.length < 12 || nueva.length > 128 || !/[a-z]/.test(nueva) || !/[A-Z]/.test(nueva) || !/\d/.test(nueva)) return 'Usa entre 12 y 128 caracteres, con mayúsculas, minúsculas y números.'
  return nueva === confirmacion ? null : 'Las contraseñas no coinciden.'
}
