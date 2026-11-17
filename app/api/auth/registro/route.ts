import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { origenValido } from '@/lib/cuenta/servidor'
import { validarRegistroPaciente } from '@/lib/cuenta/registro'

const headers = { 'Cache-Control': 'no-store' }
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403, headers })
  let datos
  try {
    const texto = await request.text()
    if (texto.length > 4000) return NextResponse.json({ error: 'La solicitud supera el tamaño permitido.' }, { status: 413, headers })
    datos = validarRegistroPaciente(JSON.parse(texto))
  } catch (e) { return NextResponse.json({ error: e instanceof SyntaxError ? 'Solicitud inválida.' : (e as Error).message }, { status: 400, headers }) }
  try {
    // Cliente público de Auth: nunca se usa createUser ni se confirma el correo con la clave de servicio.
    const db = await createClient()
    const disponible = await db.rpc('clinica_registro_habilitado')
    if (disponible.error || disponible.data !== true) return NextResponse.json({ error: 'El registro todavía no está disponible. Contacta con recepción.' }, { status: 503, headers })
    const r = await db.auth.signUp({ email: datos.correo, password: datos.nueva, options: { emailRedirectTo: new URL('/auth/callback', request.url).toString(), data: { nombre_completo: datos.personales.nombre, cn_registro_paciente: datos.personales } } })
    if (r.error) {
      const codigo = r.error.code ?? ''
      if (r.error.status === 429 || /rate_limit/.test(codigo)) return NextResponse.json({ error: 'Se alcanzó el límite de intentos o correos. Espera unos minutos antes de intentarlo de nuevo.' }, { status: 429, headers })
      if (codigo === 'signup_disabled') return NextResponse.json({ error: 'El registro está desactivado temporalmente. Contacta con recepción.' }, { status: 503, headers })
      if (codigo === 'email_address_not_authorized' || /error sending confirmation email/i.test(r.error.message ?? '')) return NextResponse.json({ error: 'La clínica necesita configurar el servicio de confirmación por correo. Contacta con recepción.' }, { status: 503, headers })
      if (codigo === 'weak_password') return NextResponse.json({ error: 'La contraseña no cumple los requisitos. Elige otra contraseña.' }, { status: 400, headers })
      return NextResponse.json({ error: 'No se pudo completar el registro. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña. Si recepción ya registró tu ficha, solicita tu invitación al portal.' }, { status: 400, headers })
    }
    if (!r.data.user) return NextResponse.json({ error: 'No se pudo comprobar el registro. Inténtalo nuevamente.' }, { status: 503, headers })
    return NextResponse.json({ ok: true, requiereConfirmacion: !r.data.session }, { headers })
  } catch { return NextResponse.json({ error: 'No se pudo conectar con el servicio de registro. Inténtalo nuevamente.' }, { status: 503, headers }) }
}
