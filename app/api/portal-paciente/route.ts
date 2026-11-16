import { NextResponse } from 'next/server'
import { cuentaAutenticada } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
export async function GET() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'paciente') return NextResponse.json({ error: 'Esta sección es exclusiva del paciente.' }, { status: 403 })
  // La función obtiene al paciente desde auth.uid(); no acepta IDs del navegador.
  const r = await a.db.rpc('clinica_portal_paciente')
  if (r.error) return errorOperacion(r.error)
  return NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
