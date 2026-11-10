import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
type Contexto = { params: Promise<{ id: string }> }
export async function GET(_request: Request, contexto: Contexto) {
  const acceso = await cuentaAutenticada()
  if (acceso.respuesta) return acceso.respuesta
  if (acceso.usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo administración puede gestionar médicos tratantes.' }, { status: 403 })
  const id = Number((await contexto.params).id)
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Paciente inválido.' }, { status: 400 })
  const [asignaciones, medicos, version, paciente] = await Promise.all([
    acceso.db.from('paciente_medicos').select('medico_id,activo,tipo').eq('paciente_id', id),
    acceso.db.from('perfiles_medicos').select('id,especialidad,usuarios(nombre_completo,esta_activo)').eq('esta_activo', true).order('id'),
    acceso.db.rpc('clinica_version_asignacion', { p_id: id }),
    acceso.db.from('perfiles_pacientes').select('id').eq('id', id).maybeSingle(),
  ])
  const error = asignaciones.error ?? medicos.error ?? version.error ?? paciente.error
  if (error) return errorOperacion(error)
  if (!paciente.data) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 })
  return NextResponse.json({ asignaciones: asignaciones.data, medicos: (medicos.data ?? []).map(m => { const u = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios; return { id: m.id, nombre: u?.nombre_completo, especialidad: m.especialidad, activo: u?.esta_activo } }).filter(m => m.activo), version: version.data }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function PATCH(request: Request, contexto: Contexto) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const acceso = await cuentaAutenticada()
  if (acceso.respuesta) return acceso.respuesta
  if (acceso.usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo administración puede asignar médicos.' }, { status: 403 })
  try {
    const id = Number((await contexto.params).id), body = await request.json()
    if (!Number.isSafeInteger(id) || id < 1 || !Array.isArray(body.medicos) || typeof body.version !== 'string' || typeof body.motivo !== 'string') return NextResponse.json({ error: 'Revisa la asignación.' }, { status: 400 })
    const r = await acceso.db.rpc('clinica_asignar_medicos', { p_paciente: id, p_medicos: body.medicos, p_version: body.version, p_motivo: body.motivo })
    return r.error ? errorOperacion(r.error) : NextResponse.json(r.data)
  } catch { return NextResponse.json({ error: 'No se pudo guardar la asignación.' }, { status: 400 }) }
}
