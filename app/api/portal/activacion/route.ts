import { NextResponse } from 'next/server'
import { origenValido } from '@/lib/cuenta/servidor'
import { validarNuevaContrasena } from '@/lib/cuenta/recuperacion'
import { clienteAdmin } from '@/lib/supabase/admin-servidor'
const headers = { 'Cache-Control': 'no-store' }
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  try {
    const texto = await request.text()
    if (texto.length > 3000) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
    const b = JSON.parse(texto)
    if (!/^[a-f0-9]{64}$/.test(b?.token ?? '') || !['verificar', 'activar'].includes(b?.accion)) return NextResponse.json({ error: 'El enlace es inválido o venció. Solicita otra invitación a recepción.' }, { status: 400, headers })
    const db = clienteAdmin(), r = await db.rpc('clinica_invitacion_validar', { p_token: b.token })
    if (r.error || !r.data) return NextResponse.json({ error: 'El enlace es inválido o venció. Solicita otra invitación a recepción.' }, { status: 400, headers })
    if (r.data.activada) return NextResponse.json({ activada: true }, { headers })
    if (b.accion === 'verificar') return NextResponse.json({ nombre: r.data.nombre, correo: r.data.correo, activada: false }, { headers })
    const validacion = validarNuevaContrasena(b.nueva, b.confirmacion)
    if (validacion) return NextResponse.json({ error: validacion }, { status: 400, headers })
    const nueva = await db.auth.admin.createUser({ email: r.data.correo, password: b.nueva, email_confirm: true, user_metadata: { cn_invitacion: b.token } })
    if (nueva.error) {
      // Una respuesta perdida no obliga a crear otra cuenta ni cambia la contraseña.
      const estado = await db.rpc('clinica_invitacion_validar', { p_token: b.token })
      if (estado.data?.activada) return NextResponse.json({ activada: true }, { headers })
      return NextResponse.json({ error: 'No se pudo activar la cuenta. El enlace pudo cambiar; solicita una nueva invitación a recepción.' }, { status: 409, headers })
    }
    return NextResponse.json({ activada: true }, { headers })
  } catch { return NextResponse.json({ error: 'No se pudo completar la activación. Inténtalo nuevamente.' }, { status: 400, headers }) }
}
