import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { origenValido } from '@/lib/cuenta/servidor'
import { COOKIE_RECUPERACION, validarNuevaContrasena } from '@/lib/cuenta/recuperacion'

async function acceso() {
  const db = await createClient(), cookie = (await cookies()).get(COOKIE_RECUPERACION)?.value
  const { data: { user }, error } = await db.auth.getUser()
  return { db, valido: Boolean(user && !error && cookie === user.id) }
}
export async function GET() {
  const { valido } = await acceso()
  return NextResponse.json({ valido }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  try {
    const { db, valido } = await acceso()
    if (!valido) return NextResponse.json({ error: 'El enlace ya no es válido. Solicita uno nuevo.' }, { status: 401 })
    const body = await request.json(), errorClave = validarNuevaContrasena(body.nueva, body.confirmacion)
    if (errorClave) return NextResponse.json({ error: errorClave }, { status: 400 })
    const { error } = await db.auth.updateUser({ password: body.nueva })
    if (error) return NextResponse.json({ error: 'No se pudo actualizar la contraseña. Solicita un nuevo enlace o inténtalo más tarde.' }, { status: 400 })
    ;(await cookies()).delete({ name: COOKIE_RECUPERACION, path: '/api/auth/restablecer' })
    const salida = await db.auth.signOut({ scope: 'global' })
    return NextResponse.json({ ok: true, advertencia: salida.error ? 'La contraseña cambió. Revisa las sesiones abiertas desde Configuración.' : undefined })
  } catch { return NextResponse.json({ error: 'No se pudo completar la recuperación.' }, { status: 500 }) }
}
