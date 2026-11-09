import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

// Cada API comprueba su propia sesión con getUser() y puede renovar sus cookies.
export const config = { matcher: ['/', '/auth/:path*'] }
