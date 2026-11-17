export function nombrePersonaValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length >= 3 && valor.trim().length <= 200 && /^[\p{L}\p{M} .’'\-]+$/u.test(valor) && /\p{L}/u.test(valor)
}
export function telefonoValido(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === '' || (typeof valor === 'string' && /^[0-9]{10}$/.test(valor))
}
export function correoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length <= 150 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(valor.trim())
}
export function validarContactoEmergencia(nombre: unknown, telefono: unknown): string | null {
  if ((nombre !== null && nombre !== undefined && typeof nombre !== 'string') || !telefonoValido(telefono)) return 'Revisa el contacto de emergencia: el teléfono debe tener exactamente 10 dígitos.'
  const contacto = typeof nombre === 'string' ? nombre.trim() : ''
  if (Boolean(contacto) !== Boolean(telefono)) return 'Completa el nombre y el teléfono del contacto de emergencia, o deja ambos vacíos.'
  if (contacto && !nombrePersonaValido(contacto)) return 'El contacto de emergencia debe tener un nombre de 3 a 200 caracteres, sin números ni símbolos.'
  return null
}
export function validarNombreTelefono(nombre: unknown, telefono: unknown): string | null {
  if (!nombrePersonaValido(nombre)) return 'Escribe un nombre de 3 a 200 caracteres, sin números ni símbolos. Se permiten acentos, apóstrofos y guiones.'
  if (!telefonoValido(telefono)) return 'El teléfono debe contener exactamente 10 dígitos, sin espacios ni prefijo de país.'
  return null
}
export function validarNacimiento(valor: unknown): boolean {
  if (valor === '' || valor === null || valor === undefined) return true
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(`${valor}T12:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor && valor >= '1900-01-01' && valor <= new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date())
}

export type DatosPersonalesPaciente = {
  fechaNacimiento: string; genero: string; contactoEmergencia: string; telefonoEmergencia: string; version: string
}
export function validarMisDatos(datos: Record<string, unknown>): string | null {
  const nombreTelefono = validarNombreTelefono(datos.nombre, datos.telefono)
  if (nombreTelefono) return nombreTelefono
  if (typeof datos.version !== 'string' || !/^[a-f0-9]{32}$/.test(datos.version)) return 'Actualiza tu perfil antes de guardar.'
  if (typeof datos.fechaNacimiento !== 'string' || typeof datos.contactoEmergencia !== 'string' || typeof datos.telefonoEmergencia !== 'string') return 'Completa los campos de tu perfil antes de guardar.'
  if (!validarNacimiento(datos.fechaNacimiento)) return 'Escribe una fecha de nacimiento válida, entre 1900 y hoy.'
  if (typeof datos.genero !== 'string' || !['', 'M', 'F', 'O'].includes(datos.genero)) return 'Selecciona un género válido.'
  return validarContactoEmergencia(datos.contactoEmergencia, datos.telefonoEmergencia)
}
