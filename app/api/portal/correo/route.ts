import { NextResponse } from 'next/server'
import { origenValido } from '@/lib/cuenta/servidor'
import { clienteAdmin } from '@/lib/supabase/admin-servidor'
const headers = { 'Cache-Control': 'no-store' }
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  try {
    const texto = await request.text()
    if (texto.length > 1000) throw Error()
    const b = JSON.parse(texto)
    if (!/^[a-f0-9]{64}$/.test(b?.token ?? '') || !['verificar', 'confirmar'].includes(b?.accion)) throw Error()
    const db = clienteAdmin(), r = await db.rpc('clinica_cambio_correo_validar', { p_token: b.token })
    if (r.error || !r.data) throw Error()
    if (r.data.confirmada) return NextResponse.json({ confirmada: true }, { headers })
    if (b.accion === 'verificar') return NextResponse.json({ nombre: r.data.nombre, correo: r.data.correo }, { headers })
    const cambio = await db.auth.admin.updateUserById(r.data.authId, { email: r.data.correo, email_confirm: true, user_metadata: { cn_cambio_correo: b.token } })
    if (cambio.error) {
      const estado = await db.rpc('clinica_cambio_correo_validar', { p_token: b.token })
      if (estado.data?.confirmada) return NextResponse.json({ confirmada: true }, { headers })
      return NextResponse.json({ error: 'No se pudo confirmar el cambio. Tu correo anterior se conserva; solicita otra revisión a recepción.' }, { status: 409, headers })
    }
    return NextResponse.json({ confirmada: true }, { headers })
  } catch { return NextResponse.json({ error: 'El enlace es inválido o venció. Solicita una nueva confirmación a recepción.' }, { status: 400, headers }) }
}
