import { NextResponse } from 'next/server'
import cuentas from '@/lib/cuenta/cuentas-prueba.json'

export const dynamic = 'force-dynamic'

export function GET() {
  const ajuste = process.env.HABILITAR_ACCESOS_PRUEBA
  const habilitado = ajuste === 'true' || (process.env.NODE_ENV === 'development' && ajuste !== 'false')
  const datos = habilitado
    ? { habilitado: true, cuentas, clave: process.env.CLAVE_CUENTAS_PRUEBA || 'Clinica123*' }
    : { habilitado: false }
  return NextResponse.json(datos, { headers: { 'Cache-Control': 'private, no-store' } })
}
