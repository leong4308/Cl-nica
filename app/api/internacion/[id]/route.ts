import { errorOperacion } from '@/lib/supabase/error-operacion'
import { NextResponse } from 'next/server'
import { accesoHospital, idHospital, mapearIngreso, operarHospital, respuestaErrorHospital, SELECCION_INGRESO } from '@/lib/internacion/servidor'
import { modificarIngreso } from '@/lib/internacion/operaciones'
import { origenValido } from '@/lib/cuenta/servidor'

type Contexto = { params: Promise<{ id: string }> }
export async function GET(_request: Request, contexto: Contexto) {
  try {
    const acceso = await accesoHospital()
    if ('respuesta' in acceso) return acceso.respuesta
    const id = idHospital((await contexto.params).id)
    const [ingreso, eventos] = await Promise.all([
      acceso.db.from('internaciones').select(SELECCION_INGRESO).eq('id', id).maybeSingle(),
      acceso.db.from('episodios_medicos').select('id,fecha_hora,tipo_episodio,descripcion,otros_signos,perfiles_medicos(usuarios(nombre_completo))').eq('internacion_id', id).order('fecha_hora', { ascending: false }).limit(100),
    ])
    if (ingreso.error || eventos.error) throw Error('No se pudo cargar el detalle de hospitalización.')
    if (!ingreso.data) return NextResponse.json({ error: 'Ingreso no encontrado o sin acceso.' }, { status: 404 })
    const movimientos = (eventos.data ?? []).map((fila: any) => { const medico = Array.isArray(fila.perfiles_medicos) ? fila.perfiles_medicos[0] : fila.perfiles_medicos; const usuario = Array.isArray(medico?.usuarios) ? medico.usuarios[0] : medico?.usuarios; return { id: fila.id, fecha: fila.fecha_hora, tipo: fila.tipo_episodio, descripcion: fila.descripcion ?? '', autor: fila.otros_signos?.auditoria?.nombre ?? usuario?.nombre_completo ?? 'Personal clínico' } })
    return NextResponse.json({ ingreso: mapearIngreso(ingreso.data), movimientos }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return respuestaErrorHospital(error) }
}
export async function PATCH(request: Request, contexto: Contexto) {
  try {
    if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
    const acceso = await accesoHospital()
    if ('respuesta' in acceso) return acceso.respuesta
    const id = idHospital((await contexto.params).id), body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Revisa los datos del ingreso.' }, { status: 400 })
    const r = await acceso.db.rpc('clinica_hospital', { p_id: id, p_datos: body })
    return r.error ? errorOperacion(r.error) : NextResponse.json(r.data)
  } catch (error) { return respuestaErrorHospital(error) }
}
