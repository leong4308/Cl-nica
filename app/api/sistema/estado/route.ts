import { NextResponse } from 'next/server'
import { cuentaAutenticada } from '@/lib/cuenta/servidor'
export async function GET() {
  const acceso = await cuentaAutenticada()
  if (acceso.respuesta) return acceso.respuesta
  if (acceso.usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo administración puede consultar este estado.' }, { status: 403 })
  const version = await acceso.db.rpc('clinica_version')
  return NextResponse.json({ baseActualizada: !version.error && version.data >= 19, version: version.error ? null : version.data, accesosPrueba: process.env.HABILITAR_ACCESOS_PRUEBA === 'true', fecha: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
