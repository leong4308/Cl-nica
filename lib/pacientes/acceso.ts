import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { pacientesDelMedico } from './listado'

export type RegistroClinico = 'pacientes' | 'citas' | 'expedientes' | 'ordenes' | 'laboratorio'
const uno = (v: any) => Array.isArray(v) ? v[0] : v
export async function autorizarRegistro(db: SupabaseClient, tipo: RegistroClinico, id: number, solicitante: { id: number; rol: string }) {
  if (solicitante.rol !== 'medico') return null // Cada ruta valida previamente sus roles permitidos.
  try {
    let pacienteId: number | undefined = tipo === 'pacientes' ? id : undefined
    if (tipo !== 'pacientes') {
      const campos = { citas: 'paciente_id', expedientes: 'citas(paciente_id)', ordenes: 'episodios_medicos(internaciones(paciente_id))', laboratorio: 'ordenes_medicas(episodios_medicos(internaciones(paciente_id)))' }
      const tabla = { citas: 'citas', expedientes: 'expedientes', ordenes: 'ordenes_medicas', laboratorio: 'solicitudes_analisis' }
      const r = await db.from(tabla[tipo]).select(campos[tipo]).eq('id', id).maybeSingle()
      if (r.error) throw Error('No se pudo verificar el registro.')
      let fila: any = r.data
      if (tipo === 'expedientes') fila = uno(fila?.citas)
      if (tipo === 'laboratorio') fila = uno(fila?.ordenes_medicas)
      if (tipo === 'ordenes' || tipo === 'laboratorio') fila = uno(uno(fila?.episodios_medicos)?.internaciones)
      pacienteId = fila?.paciente_id
    }
    let permitido = false
    if (pacienteId) {
      const rpc = await db.rpc('clinica_paciente', { p_id: pacienteId })
      if (!rpc.error) permitido = rpc.data === true
      else if (rpc.error.code === 'PGRST202') permitido = (await pacientesDelMedico(db, solicitante.id)).ids.includes(pacienteId)
      else throw Error('No se pudo verificar el acceso.')
    }
    return permitido ? null : NextResponse.json({ error: 'Este paciente no está vinculado a tu atención.' }, { status: 403 })
  } catch { return NextResponse.json({ error: 'No se pudo verificar el acceso al paciente. Inténtalo nuevamente.' }, { status: 503 }) }
}
