import { errorOperacion } from '@/lib/supabase/error-operacion'
import { NextResponse } from 'next/server'
import { accesoHospital, datosHospital, operarHospital, respuestaErrorHospital } from '@/lib/internacion/servidor'
import { crearIngreso, sincronizarOcupacion } from '@/lib/internacion/operaciones'
import { origenValido } from '@/lib/cuenta/servidor'

export async function GET() {
  try {
    const acceso = await accesoHospital()
    if ('respuesta' in acceso) return acceso.respuesta
    return NextResponse.json(await datosHospital(acceso.db, acceso.usuario.rol), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return respuestaErrorHospital(error) }
}
export async function POST(request: Request) {
  try {
    if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
    const acceso = await accesoHospital()
    if ('respuesta' in acceso) return acceso.respuesta
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Revisa los datos del ingreso.' }, { status: 400 })
    const r = await acceso.db.rpc('clinica_hospital', { p_id: null, p_datos: body })
    return r.error ? errorOperacion(r.error) : NextResponse.json(r.data)
  } catch (error) { return respuestaErrorHospital(error) }
}
