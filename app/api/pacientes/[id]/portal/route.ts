import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { clienteAdmin } from '@/lib/supabase/admin-servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
import { configuracionCorreo, correoInvitacion, enviarCorreo } from '@/lib/notificaciones/correo.mjs'
const headers = { 'Cache-Control': 'private, no-store' }
async function acceso(params: Promise<{ id: string }>) {
  const a = await cuentaAutenticada()
  if (a.respuesta) return { respuesta: a.respuesta } as const
  if (!['admin', 'recepcionista'].includes(a.usuario.rol)) return { respuesta: NextResponse.json({ error: 'Solo administración y recepción invitan al portal.' }, { status: 403 }) } as const
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id < 1) return { respuesta: NextResponse.json({ error: 'Paciente inválido.' }, { status: 400 }) } as const
  return { id, actor: a.user.id, db: clienteAdmin(a.user.id) } as const
}
export async function GET(_: Request, contexto: { params: Promise<{ id: string }> }) {
  const a = await acceso(contexto.params)
  if (a.respuesta) return a.respuesta
  const r = await a.db.rpc('clinica_estado_portal', { p_paciente: a.id, p_actor: a.actor })
  return r.error ? errorOperacion(r.error) : NextResponse.json({ ...r.data, configurado: Boolean(configuracionCorreo()) }, { headers })
}
export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await acceso(contexto.params)
  if (a.respuesta) return a.respuesta
  const config = configuracionCorreo()
  if (!config) return NextResponse.json({ error: 'Administración debe configurar el servicio de correo y APP_URL antes de enviar invitaciones.' }, { status: 503 })
  let b
  try { b = JSON.parse((await request.text()).slice(0, 2000)) } catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }) }
  if (b?.confirmarCorreo !== true) return NextResponse.json({ error: 'Confirma con el paciente su dirección de correo.' }, { status: 400 })
  const r = await a.db.rpc('clinica_invitacion_preparar', { p_paciente: a.id, p_actor: a.actor })
  if (r.error) return errorOperacion(r.error)
  const i = r.data
  try {
    await enviarCorreo(config, i.correo, correoInvitacion(i.nombre, `${config.appUrl}/activar-cuenta#${i.token}`), `clinica-invitacion-${i.id}`)
    await a.db.from('portal_invitaciones').update({ enviada_en: new Date().toISOString(), codigo_error: null }).eq('id', i.id)
    return NextResponse.json({ ok: true, mensaje: 'El servicio de correo aceptó la invitación. El paciente debe revisar su bandeja de entrada y correo no deseado.' }, { headers })
  } catch (error) {
    const codigo = (error as { codigo?: string }).codigo ?? 'ENVIO'
    await a.db.from('portal_invitaciones').update({ codigo_error: codigo }).eq('id', i.id)
    return NextResponse.json({ error: codigo === 'HTTP_403' ? 'El proveedor rechazó el destinatario o remitente. En modo de prueba de Resend solo puedes enviar al correo de tu propia cuenta; para otros pacientes verifica un dominio.' : 'No se pudo confirmar el envío. Revisa la configuración de correo y vuelve a intentarlo después de un minuto.' }, { status: 502, headers })
  }
}
