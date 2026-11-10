import { NextResponse } from 'next/server'
export function errorOperacion(error: { code?: string; message?: string }) {
  if (error.code === 'PGRST202' || error.code === 'PGRST205') return NextResponse.json({ error: 'El administrador debe completar la actualización de la base de datos para habilitar esta operación.' }, { status: 503 })
  const status = error.code === '42501' ? 403 : ['23P01', '23505', '40001'].includes(error.code ?? '') ? 409 : ['P0001', '22007', '22P02', '23514'].includes(error.code ?? '') ? 400 : 500
  if (status === 500) console.error(JSON.stringify({ evento: 'error_operacion', fecha: new Date().toISOString(), codigo: error.code ?? 'desconocido' }))
  return NextResponse.json({ error: status === 500 ? 'No se pudo completar la operación. Inténtalo más tarde.' : error.message ?? 'Revisa los datos de la operación.' }, { status })
}
