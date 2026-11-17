import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
const modulos = ['Citas', 'Pacientes', 'Médicos', 'Expedientes', 'Internación', 'Órdenes médicas', 'Laboratorio']
async function acceso() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a
  if (a.usuario.rol !== 'admin') return { respuesta: NextResponse.json({ error: 'Solo administración puede eliminar registros.' }, { status: 403 }) }
  return a
}
export async function GET(request: Request) {
  const a = await acceso(); if (a.respuesta) return a.respuesta
  const q = new URL(request.url).searchParams, modulo = q.get('modulo'), id = Number(q.get('id'))
  if (!modulos.includes(modulo ?? '') || !Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400 })
  const r = await a.db.rpc('clinica_admin_eliminacion_info', { p_modulo: modulo, p_id: id })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function DELETE(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await acceso(); if (a.respuesta) return a.respuesta
  const texto = await request.text()
  if (texto.length > 3000) return NextResponse.json({ error: 'La solicitud es demasiado extensa.' }, { status: 413 })
  let b; try { b = JSON.parse(texto) } catch { return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 }) }
  if (!b || !modulos.includes(b.modulo) || !Number.isSafeInteger(b.id) || b.id <= 0 || b.confirmado !== true || typeof b.version !== 'string' || !/^[a-f0-9]{32}$/.test(b.version) || typeof b.motivo !== 'string' || b.motivo.trim().length < 10 || b.motivo.length > 1000) return NextResponse.json({ error: 'Confirma la advertencia e indica un motivo de 10 a 1000 caracteres.' }, { status: 400 })
  const r = await a.db.rpc('clinica_admin_eliminar', { p_modulo: b.modulo, p_id: b.id, p_version: b.version, p_motivo: b.motivo.trim(), p_confirmar: true })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data)
}
