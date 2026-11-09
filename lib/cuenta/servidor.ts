import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function cuentaAutenticada() {
  const db = await createClient()
  const { data: { user }, error: errorSesion } = await db.auth.getUser()
  if (!user || errorSesion) return { respuesta: NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 }) } as const
  const { data: usuario, error } = await db.from('usuarios').select('id, auth_user_id, nombre_completo, correo, telefono, rol, esta_activo, creado_en').eq('auth_user_id', user.id).maybeSingle()
  if (error || !usuario?.esta_activo) return { respuesta: NextResponse.json({ error: 'No se encontró una cuenta activa.' }, { status: 403 }) } as const
  return { db, user, usuario } as const
}
export function origenValido(request: Request): boolean {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}
