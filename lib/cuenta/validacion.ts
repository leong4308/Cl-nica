export function validarNombreTelefono(nombre: unknown, telefono: unknown): string | null {
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 200) return 'Escribe un nombre de hasta 200 caracteres.'
  if (telefono !== null && telefono !== undefined && (typeof telefono !== 'string' || telefono.trim().length > 20 || (telefono.trim() && !/^[+\d\s().-]+$/.test(telefono)))) return 'Revisa el teléfono; admite hasta 20 caracteres.'
  return null
}
export function validarNacimiento(valor: unknown): boolean {
  if (valor === '' || valor === null || valor === undefined) return true
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(`${valor}T12:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor && valor <= new Date().toISOString().slice(0, 10)
}

export type DatosPersonalesPaciente = {
  fechaNacimiento: string; genero: string; contactoEmergencia: string; telefonoEmergencia: string; version: string
}
export function validarMisDatos(datos: Record<string, unknown>): string | null {
  const nombreTelefono = validarNombreTelefono(datos.nombre, datos.telefono)
  if (nombreTelefono) return nombreTelefono
  if (typeof datos.version !== 'string' || !/^[a-f0-9]{32}$/.test(datos.version)) return 'Actualiza tu perfil antes de guardar.'
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date())
  const nacimiento = datos.fechaNacimiento
  if (nacimiento !== '' && (typeof nacimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || !Number.isFinite(Date.parse(nacimiento)) || new Date(nacimiento).toISOString().slice(0, 10) !== nacimiento || nacimiento > hoy)) return 'Escribe una fecha de nacimiento válida, sin fechas futuras.'
  if (typeof datos.genero !== 'string' || !['', 'M', 'F', 'O'].includes(datos.genero)) return 'Selecciona un género válido.'
  if (typeof datos.contactoEmergencia !== 'string' || datos.contactoEmergencia.trim().length > 200) return 'El contacto de emergencia admite hasta 200 caracteres.'
  if (typeof datos.telefonoEmergencia !== 'string' || validarNombreTelefono('Contacto', datos.telefonoEmergencia)) return 'Revisa el teléfono de emergencia; admite hasta 20 caracteres.'
  return null
}
