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
