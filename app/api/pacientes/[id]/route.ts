import { errorOperacion } from '@/lib/supabase/error-operacion'
import { autorizarRegistro } from '@/lib/pacientes/acceso'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { validarNacimiento, validarNombreTelefono, validarContactoEmergencia } from '@/lib/cuenta/validacion'
import { configuracionCorreo, correoCambioAcceso, enviarCorreo } from '@/lib/notificaciones/correo.mjs'

type Contexto = { params: Promise<{ id: string }> }
const fallo = (error: string, status: number) => NextResponse.json({ error }, { status })
const correoVisible = (valor: string) => valor?.toLowerCase().endsWith('@clinica.local') ? '' : valor?.trim().toLowerCase() ?? ''
const clienteAdmin = (actor: string) => createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { 'x-clinica-actor': actor } } })
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
  const consulta = solicitante.rol === 'recepcionista'
    ? await db.rpc('clinica_directorio_recepcion', { p_id: id }).then(r => ({ data: r.data?.[0], error: r.error }))
    : await db.from('perfiles_pacientes').select('id, usuario_id, fecha_nacimiento, genero, nombre_contacto_emergencia, telefono_emergencia, usuarios(nombre_completo, correo, telefono)').eq('id', id).maybeSingle()
  const { data, error } = consulta
  if (error) return { respuesta: fallo('No se pudo consultar el paciente.', 500) } as const
  if (!data) return { respuesta: fallo('Paciente no encontrado o sin acceso.', 404) } as const
  const usuario = Array.isArray(data.usuarios) ? data.usuarios[0] : data.usuarios
  if (!usuario) return { respuesta: fallo('No se encontró la información del paciente.', 404) } as const
  return { id, perfil: data, usuario, db, rol: solicitante.rol, actor: user.id } as const
}
export async function GET(_request: Request, contexto: Contexto) {
  try {
    const acceso = await autorizar(contexto)
    if ('respuesta' in acceso) return acceso.respuesta
    const { perfil, usuario } = acceso
    const puedeEditarCorreo = ['admin', 'recepcionista'].includes(acceso.rol)
    let estadoCorreo
    if (puedeEditarCorreo) {
      const sesion = await acceso.db.rpc('clinica_estado_sesion', { p_accion: 'estado' })
      if (sesion.error) return errorOperacion(sesion.error)
      if (sesion.data?.bloqueada) return fallo('Tu sesión está bloqueada. Verifica tu contraseña.', 423)
      const estado = await clienteAdmin(acceso.actor).rpc('clinica_estado_correo_paciente', { p_paciente: acceso.id, p_actor: acceso.actor })
      if (estado.error) return errorOperacion(estado.error)
      estadoCorreo = estado.data
    }
    return NextResponse.json({ puedeEditarCorreo, accesoVinculado: estadoCorreo?.vinculado ?? false, correoPendiente: estadoCorreo?.pendiente ?? null, paciente: { id: perfil.id, nombre: usuario.nombre_completo, correo: correoVisible(usuario.correo), telefono: usuario.telefono ?? '', fechaNacimiento: perfil.fecha_nacimiento ?? '', genero: perfil.genero ?? '', contactoEmergencia: perfil.nombre_contacto_emergencia ?? '', telefonoEmergencia: perfil.telefono_emergencia ?? '' } }, { headers: { 'Cache-Control': 'private, no-store' } })
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
    if (typeof body.contactoEmergencia !== 'string' || typeof body.telefonoEmergencia !== 'string') return fallo('Revisa los datos del contacto de emergencia.', 400)
    const errorContacto = validarContactoEmergencia(body.contactoEmergencia, body.telefonoEmergencia)
    if (errorContacto) return fallo(errorContacto, 400)
    if (body.correo !== undefined && typeof body.correo !== 'string') return fallo('Escribe un correo válido.', 400)
    const actual = correoVisible(acceso.usuario.correo), nuevo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : actual
    const cambiaCorreo = nuevo !== actual
    let admin: ReturnType<typeof clienteAdmin> | undefined, vinculado = false
    const config = configuracionCorreo()
    if (cambiaCorreo) {
      if (!['admin', 'recepcionista'].includes(acceso.rol)) return fallo('Solo administración y recepción modifican el correo de acceso.', 403)
      if (nuevo.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo) || nuevo.endsWith('@clinica.local')) return fallo('Escribe un correo electrónico válido del paciente.', 400)
      if (typeof body.correoAnterior !== 'string' || body.correoAnterior.trim().toLowerCase() !== actual) return fallo('El correo cambió. Cierra y vuelve a abrir la ficha antes de guardar.', 409)
      const sesion = await acceso.db.rpc('clinica_estado_sesion', { p_accion: 'estado' })
      if (sesion.error) return errorOperacion(sesion.error)
      if (sesion.data?.bloqueada) return fallo('Tu sesión está bloqueada. Verifica tu contraseña.', 423)
      admin = clienteAdmin(acceso.actor)
      const estado = await admin.rpc('clinica_estado_correo_paciente', { p_paciente: acceso.id, p_actor: acceso.actor })
      if (estado.error) return errorOperacion(estado.error)
      vinculado = estado.data.vinculado
      if (vinculado && !config) return fallo('Configura el servicio de correo antes de cambiar el acceso de una cuenta activa. El correo actual se conserva.', 503)
    }
    const datos: Record<string, unknown> = { nombre: body.nombre, telefono: body.telefono, fechaNacimiento: body.fechaNacimiento, genero: body.genero, contactoEmergencia: body.contactoEmergencia, telefonoEmergencia: body.telefonoEmergencia }
    if (cambiaCorreo && !vinculado) { datos.correo = nuevo; datos.correoAnterior = actual }
    const r = await acceso.db.rpc('clinica_actualizar_paciente', { p_paciente: acceso.id, p_datos: datos })
    if (r.error) return errorOperacion(r.error)
    const headers = { 'Cache-Control': 'private, no-store' }
    if (cambiaCorreo && vinculado && admin && config) {
      const parcial = (errorCorreo: string) => NextResponse.json({ ok: true, correoActual: actual, mensaje: 'Se guardaron los datos personales. El correo de acceso actual se conserva.', errorCorreo }, { headers })
      const solicitud = await admin.rpc('clinica_cambio_correo_preparar', { p_paciente: acceso.id, p_actor: acceso.actor, p_correo: nuevo, p_anterior: actual })
      if (solicitud.error) { const e = await errorOperacion(solicitud.error).json(); return parcial(e.error) }
      const i = solicitud.data
      if (!i.enviada) {
        try {
          await enviarCorreo(config, i.correo, correoCambioAcceso(i.nombre, i.correo, `${config.appUrl}/confirmar-correo#${i.token}`), `clinica-cambio-correo-${i.id}`)
          await admin.from('paciente_correos_cambio').update({ enviada_en: new Date().toISOString(), codigo_error: null }).eq('id', i.id)
        } catch (e) {
          await admin.from('paciente_correos_cambio').update({ codigo_error: (e as { codigo?: string }).codigo ?? 'ENVIO' }).eq('id', i.id)
          return parcial('No se pudo confirmar el envío al nuevo correo. Revisa el remitente y destinatario; el modo de prueba de Resend solo permite enviar al titular. Puedes reintentar después de un minuto.')
        }
      }
      return NextResponse.json({ ok: true, correoActual: actual, correoPendiente: nuevo, mensaje: 'Se guardaron los datos personales y el servicio aceptó la confirmación enviada al nuevo correo. El paciente debe abrirla; hasta entonces ingresará con su correo actual.' }, { headers })
    }
    return NextResponse.json({ ...r.data, correoActual: cambiaCorreo ? nuevo : actual, mensaje: 'Información del paciente actualizada.' }, { headers })
  } catch { return fallo('No se pudo guardar el paciente.', 500) }
}
