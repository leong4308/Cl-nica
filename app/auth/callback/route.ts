import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { COOKIE_RECUPERACION, destinoSeguro } from '@/lib/cuenta/recuperacion'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = destinoSeguro(url.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const respuesta = NextResponse.redirect(new URL(next, url.origin))
      if (next === '/restablecer-contrasena') respuesta.cookies.set(COOKIE_RECUPERACION, data.user.id, { httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 600, path: '/api/auth/restablecer' })
      respuesta.headers.set('Cache-Control', 'no-store')
      return respuesta
    }
  }
  return NextResponse.redirect(new URL('/restablecer-contrasena?error=enlace', url.origin))
}
