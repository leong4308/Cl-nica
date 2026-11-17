import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'

async function acceso() {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a
  if (a.usuario.rol !== 'enfermero') return { respuesta: NextResponse.json({ error: 'El ingreso urgente se registra desde enfermería.' }, { status: 403 }) }
  return a
}
export async function GET(request: Request) {
  const a = await acceso(); if (a.respuesta) return a.respuesta
  const busqueda = new URL(request.url).searchParams.get('buscar')?.trim() ?? ''
  if (busqueda.length > 120) return NextResponse.json({ error: 'La búsqueda admite hasta 120 caracteres.' }, { status: 400 })
  const r = await a.db.rpc('clinica_enfermeria_ingresos_panel', { p_busqueda: busqueda })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(request: Request) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const a = await acceso(); if (a.respuesta) return a.respuesta
  const texto = await request.text()
  if (texto.length > 18000) return NextResponse.json({ error: 'La información de ingreso es demasiado extensa.' }, { status: 413 })
  let b; try { b = JSON.parse(texto) } catch { return NextResponse.json({ error: 'Revisa los datos del ingreso.' }, { status: 400 }) }
  if (!b || typeof b !== 'object' || !b.datos || typeof b.datos !== 'object' || Array.isArray(b.datos) || typeof b.clave !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.clave)) return NextResponse.json({ error: 'Solicitud de ingreso inválida.' }, { status: 400 })
  const d = b.datos
  if (![d.pacienteId, d.medicoId, d.camaId].every(n => Number.isSafeInteger(n) && n > 0) || d.confirmado !== true || typeof d.motivo !== 'string' || !d.motivo.trim() || d.motivo.length > 8000 || typeof d.observaciones !== 'string' || d.observaciones.length > 8000) return NextResponse.json({ error: 'Selecciona paciente, médico y cama, registra el motivo y confirma el ingreso.' }, { status: 400 })
  const r = await a.db.rpc('clinica_enfermeria_ingreso_registrar', { p_datos: { pacienteId: d.pacienteId, medicoId: d.medicoId, camaId: d.camaId, motivo: d.motivo.trim(), observaciones: d.observaciones.trim(), confirmado: true }, p_clave: b.clave })
  return r.error ? errorOperacion(r.error) : NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } })
}
