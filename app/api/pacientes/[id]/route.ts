import { errorOperacion } from '@/lib/supabase/error-operacion'
import { autorizarRegistro } from '@/lib/pacientes/acceso'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { validarNacimiento, validarNombreTelefono } from '@/lib/cuenta/validacion'

type Contexto = { params: Promise<{ id: string }> }
const fallo = (error: string, status: number) => NextResponse.json({ error }, { status })
async function autorizar(contexto: Contexto) {
  const id = Number((await contexto.params).id)
  if (!Number.isSafeInteger(id) || id <= 0) return { respuesta: fallo('Paciente inválido.', 400) } as const
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { respuesta: fallo('Inicia sesión para continuar.', 401) } as const
  const { data: solicitante } = await db.from('usuarios').select('id, rol, esta_activo').eq('auth_user_id', user.id).maybeSingle()
  if (!solicitante?.esta_activo || !['admin', 'medico', 'enfermero', 'recepcionista'].includes(solicitante.rol)) return { respuesta: fallo('No tienes permiso para editar pacientes.', 403) } as const
  const denegado = await autorizarRegistro(db, 'pacientes', id, solicitante)
  if (denegado) return { respuesta: denegado } as const
  const { data, error } = await db.from('perfiles_pacientes').select('id, usuario_id, fecha_nacimiento, genero, nombre_contacto_emergencia, telefono_emergencia, usuarios(nombre_completo, correo, telefono)').eq('id', id).maybeSingle()
  if (error) return { respuesta: fallo('No se pudo consultar el paciente.', 500) } as const
  if (!data) return { respuesta: fallo('Paciente no encontrado o sin acceso.', 404) } as const
  const usuario = Array.isArray(data.usuarios) ? data.usuarios[0] : data.usuarios
  if (!usuario) return { respuesta: fallo('No se encontró la información del paciente.', 404) } as const
  return { id, perfil: data, usuario, db } as const
}
export async function GET(_request: Request, contexto: Contexto) {
  try {
    const acceso = await autorizar(contexto)
    if ('respuesta' in acceso) return acceso.respuesta
    const { perfil, usuario } = acceso
    return NextResponse.json({ paciente: { id: perfil.id, nombre: usuario.nombre_completo, correo: usuario.correo, telefono: usuario.telefono ?? '', fechaNacimiento: perfil.fecha_nacimiento ?? '', genero: perfil.genero ?? '', contactoEmergencia: perfil.nombre_contacto_emergencia ?? '', telefonoEmergencia: perfil.telefono_emergencia ?? '' } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return fallo('No se pudo cargar la información del paciente.', 500) }
}
export async function PATCH(request: Request, contexto: Contexto) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) return fallo('Origen de solicitud inválido.', 403)
    const acceso = await autorizar(contexto)
    if ('respuesta' in acceso) return acceso.respuesta
    const body = await request.json()
    const validacion = validarNombreTelefono(body.nombre, body.telefono)
    if (validacion) return fallo(validacion, 400)
    if (!validarNacimiento(body.fechaNacimiento)) return fallo('Revisa la fecha de nacimiento.', 400)
    if (!['', 'M', 'F', 'O'].includes(body.genero ?? '')) return fallo('Género inválido.', 400)
    if (typeof body.contactoEmergencia !== 'string' || body.contactoEmergencia.length > 200 || typeof body.telefonoEmergencia !== 'string' || body.telefonoEmergencia.length > 20) return fallo('Revisa los datos del contacto de emergencia.', 400)
    const datos = { nombre: body.nombre, telefono: body.telefono, fechaNacimiento: body.fechaNacimiento, genero: body.genero, contactoEmergencia: body.contactoEmergencia, telefonoEmergencia: body.telefonoEmergencia }
    const r = await acceso.db.rpc('clinica_actualizar_paciente', { p_paciente: acceso.id, p_datos: datos })
    return r.error ? errorOperacion(r.error) : NextResponse.json(r.data)
  } catch { return fallo('No se pudo guardar el paciente.', 500) }
}
