import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { pacientesDelMedico } from './listado'

export type RegistroClinico = 'pacientes' | 'citas' | 'expedientes' | 'ordenes' | 'laboratorio'
const uno = (v: any) => Array.isArray(v) ? v[0] : v
export async function autorizarRegistro(db: SupabaseClient, tipo: RegistroClinico, id: number, solicitante: { id: number; rol: string }) {
  if (!['medico','enfermero'].includes(solicitante.rol)) return null // Cada ruta valida previamente sus roles permitidos.
  try {
    if (tipo === 'ordenes' || tipo === 'laboratorio') {
      let ordenId = id
      if (tipo === 'laboratorio') { const s = await db.from('solicitudes_analisis').select('orden_medica_id').eq('id', id).maybeSingle(); if (s.error) throw Error('Sin acceso'); ordenId = s.data?.orden_medica_id }
      const permiso = await db.rpc('clinica_orden', { p_id: ordenId })
      if (permiso.error) throw Error('No se pudo verificar la orden.')
      return permiso.data === true ? null : NextResponse.json({ error: 'La orden no pertenece a un paciente de tu atención.' }, { status: 403 })
    }
    let pacienteId: number | undefined = tipo === 'pacientes' ? id : undefined
    if (tipo !== 'pacientes') {
      const campos = { citas: 'paciente_id', expedientes: 'citas(paciente_id)', ordenes: 'episodios_medicos(internaciones(paciente_id))', laboratorio: 'ordenes_medicas(episodios_medicos(internaciones(paciente_id)))' }
      const tabla = { citas: 'citas', expedientes: 'expedientes', ordenes: 'ordenes_medicas', laboratorio: 'solicitudes_analisis' }
      const r = await db.from(tabla[tipo]).select(campos[tipo]).eq('id', id).maybeSingle()
      if (r.error) throw Error('No se pudo verificar el registro.')
      let fila: any = r.data
      if (tipo === 'expedientes') fila = uno(fila?.citas)
      pacienteId = fila?.paciente_id
    }
    let permitido = false
    if (pacienteId) {
      const rpc = await db.rpc('clinica_paciente', { p_id: pacienteId })
      if (!rpc.error) permitido = rpc.data === true
      else if (rpc.error.code === 'PGRST202' && solicitante.rol === 'medico') permitido = (await pacientesDelMedico(db, solicitante.id)).ids.includes(pacienteId)
      else throw Error('No se pudo verificar el acceso.')
    }
    return permitido ? null : NextResponse.json({ error: 'Este paciente no está vinculado a tu atención.' }, { status: 403 })
  } catch { return NextResponse.json({ error: 'No se pudo verificar el acceso al paciente. Inténtalo nuevamente.' }, { status: 503 }) }
}
