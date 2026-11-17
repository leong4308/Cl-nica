import { fechaClinica } from '@/lib/agenda/modelo'
import { validarNuevaContrasena } from './recuperacion'
import { nombrePersonaValido, telefonoValido, correoValido } from './validacion'

export type DatosPersonalesRegistro = { nombre: string; telefono: string; fechaNacimiento: string; genero: string; contactoEmergencia: string; telefonoEmergencia: string }
export type FormularioRegistro = DatosPersonalesRegistro & { correo: string; nueva: string; confirmacion: string }
const texto = (v: unknown, etiqueta: string, maximo = 200) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > maximo || /[\u0000-\u001f\u007f]/.test(v)) throw Error('Completa correctamente ' + etiqueta + '.')
  return v.trim()
}
const telefono = (v: unknown, etiqueta: string) => {
  const t = texto(v, etiqueta, 10)
  if (!telefonoValido(t)) throw Error('Revisa ' + etiqueta + ': debe contener exactamente 10 dígitos, sin espacios ni prefijo de país.')
  return t
}
export function datosPersonalesRegistro(valor: unknown, hoy = fechaClinica()): DatosPersonalesRegistro {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw Error('Completa los datos del paciente.')
  const v = valor as Record<string, unknown>
  const nombre = texto(v.nombre, 'el nombre completo'), contactoEmergencia = texto(v.contactoEmergencia, 'el nombre del contacto de emergencia')
  if (!nombrePersonaValido(nombre) || !nombrePersonaValido(contactoEmergencia)) throw Error('Los nombres deben tener de 3 a 200 caracteres, sin números ni símbolos.')
  const nacimiento = texto(v.fechaNacimiento, 'la fecha de nacimiento', 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || !Number.isFinite(Date.parse(nacimiento)) || new Date(nacimiento).toISOString().slice(0, 10) !== nacimiento || nacimiento < '1900-01-01' || nacimiento > hoy) throw Error('Selecciona una fecha de nacimiento válida, entre 1900 y hoy.')
  if (!['M', 'F', 'O'].includes(String(v.genero))) throw Error('Selecciona tu género.')
  return { nombre, telefono: telefono(v.telefono, 'tu teléfono'), fechaNacimiento: nacimiento, genero: String(v.genero), contactoEmergencia, telefonoEmergencia: telefono(v.telefonoEmergencia, 'el teléfono de emergencia') }
}
export function validarRegistroPaciente(valor: unknown, hoy = fechaClinica()) {
  const personales = datosPersonalesRegistro(valor, hoy), v = valor as Record<string, unknown>
  const correo = texto(v.correo, 'el correo electrónico', 150).toLowerCase()
  if (!correoValido(correo)) throw Error('Escribe un correo electrónico válido.')
  const error = validarNuevaContrasena(v.nueva, v.confirmacion)
  if (error) throw Error(error)
  // Solo estos campos llegan a Auth. Rol, permisos, médico e identificadores enviados se ignoran.
  return { correo, nueva: v.nueva as string, personales }
}
