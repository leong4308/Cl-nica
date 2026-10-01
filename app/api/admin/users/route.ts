import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const sessionClient = await createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as { email?: string; password?: string; nombre?: string; rol?: string }
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const nombre = body.nombre?.trim()
  const rol = body.rol?.trim() || 'medico'
  if (!email || !password || !nombre || password.length < 6) {
    return NextResponse.json({ error: 'Nombre, correo y una contraseña de al menos 6 caracteres son obligatorios.' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre_completo: nombre, rol } })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.user.id, email: data.user.email })
}
