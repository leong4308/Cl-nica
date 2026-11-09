import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'

export async function POST(request: Request) {
  try {
    if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
    const acceso = await cuentaAutenticada()
    if ('respuesta' in acceso) return acceso.respuesta
    const { actual, nueva, confirmacion, codigo } = await request.json()
    if (typeof actual !== 'string' || !actual || typeof nueva !== 'string' || nueva.length < 8 || nueva.length > 128 || nueva !== confirmacion || actual === nueva) return NextResponse.json({ error: 'Revisa la contraseña actual y la confirmación. La nueva debe tener entre 8 y 128 caracteres y ser diferente.' }, { status: 400 })
    if (!acceso.user.email) return NextResponse.json({ error: 'Esta cuenta no tiene un correo de acceso.' }, { status: 400 })
    // Verifica la contraseña en un cliente aislado, sin reemplazar la sesión actual.
    const verificador = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const { data, error: errorActual } = await verificador.auth.signInWithPassword({ email: acceso.user.email, password: actual })
    if (errorActual || data.user?.id !== acceso.user.id) return NextResponse.json({ error: errorActual?.status === 429 ? 'Demasiados intentos. Espera antes de intentarlo de nuevo.' : 'La contraseña actual es incorrecta.' }, { status: 400 })
    try {
      const { error } = await acceso.db.auth.updateUser({ password: nueva, current_password: actual, ...(typeof codigo === 'string' && codigo.trim() ? { nonce: codigo.trim() } : {}) })
      if (error) {
        const requiereCodigo = error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid'
        return NextResponse.json({ error: requiereCodigo ? 'Confirma el código de verificación para cambiar la contraseña.' : error.code === 'same_password' ? 'La nueva contraseña debe ser diferente.' : 'No se pudo actualizar la contraseña. Revisa que cumpla los requisitos de tu cuenta.', requiereCodigo }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    } finally { await verificador.auth.signOut({ scope: 'local' }).catch(() => {}) }
  } catch { return NextResponse.json({ error: 'No se pudo conectar para cambiar la contraseña.' }, { status: 500 }) }
}
