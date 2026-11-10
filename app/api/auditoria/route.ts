import { NextResponse } from 'next/server'
import { cuentaAutenticada } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
export async function GET(request: Request) {
  const acceso = await cuentaAutenticada()
  if (acceso.respuesta) return acceso.respuesta
  if (acceso.usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo administración puede consultar el historial de cambios.' }, { status: 403 })
  const url = new URL(request.url), antes = url.searchParams.get('antes'), tabla = url.searchParams.get('tabla')
  let q = acceso.db.from('auditoria_clinica').select('id,fecha,autor,autor_nombre,tabla,registro_id,accion,anterior,nuevo').order('id', { ascending: false }).limit(50)
  if (antes && /^\d+$/.test(antes)) q = q.lt('id', Number(antes))
  if (tabla && ['usuarios','perfiles_pacientes','citas','expedientes','internaciones','episodios_medicos','ordenes_medicas','solicitudes_analisis','paciente_medicos','configuracion_agenda','ordenes','laboratorio'].includes(tabla)) q = q.eq('tabla', tabla)
  const r = await q
  if (r.error) return errorOperacion(r.error)
  const autores = [...new Set((r.data ?? []).map(r => r.autor).filter(Boolean))]
  const usuarios = autores.length ? await acceso.db.from('usuarios').select('auth_user_id,nombre_completo').in('auth_user_id', autores) : { data: [], error: null }
  if (usuarios.error) return errorOperacion(usuarios.error)
  const nombres = new Map((usuarios.data ?? []).map(u => [u.auth_user_id,u.nombre_completo]))
  return NextResponse.json({ eventos: (r.data ?? []).map(e => ({ ...e, autor: e.autor_nombre ?? nombres.get(e.autor) ?? (e.autor ? 'Cuenta anterior' : 'Operación del sistema') })), siguiente: r.data?.length === 50 ? r.data[49].id : null }, { headers: { 'Cache-Control': 'private, no-store' } })
}
