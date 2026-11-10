import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cuentaAutenticada } from '@/lib/cuenta/servidor'
import { fechaClinica, instanteClinica, sumarDias, validarBloques, validarDescansos, type BloqueAgenda, type DescansoAgenda } from './modelo'
export class ErrorAgenda extends Error { constructor(message: string, public status = 400) { super(message) } }
export function errorAgenda(err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo procesar la agenda.' }, { status: err instanceof ErrorAgenda ? err.status : err instanceof SyntaxError ? 400 : 500 }) }
export async function accesoAgenda() {
  const acceso = await cuentaAutenticada()
  if (acceso.respuesta) return { respuesta: acceso.respuesta } as const
  if (!['admin', 'medico', 'recepcionista', 'enfermero'].includes(acceso.usuario.rol)) return { respuesta: NextResponse.json({ error: 'No tienes permiso para consultar las agendas.' }, { status: 403 }) } as const
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  return { ...acceso, admin }
}
export function idAgenda(valor: unknown) { if (!['string', 'number'].includes(typeof valor) || !/^\d+$/.test(String(valor)) || !Number.isSafeInteger(Number(valor)) || Number(valor) < 1) throw new ErrorAgenda('Identificador inválido.'); return Number(valor) }
export const uno = (r: any) => Array.isArray(r) ? r[0] : r
export async function medicoAgenda(db: any, id: number, usuario: { rol: string; id: number }) {
  const { data, error } = await db.from('perfiles_medicos').select('id,usuario_id,clinica_id,duracion_consulta,esta_activo,clinicas(esta_activo),usuarios(auth_user_id,esta_activo)').eq('id', id).maybeSingle()
  if (error) throw Error('No se pudo consultar al médico.')
  if (!data?.esta_activo || !uno(data.usuarios)?.esta_activo || uno(data.clinicas)?.esta_activo === false) throw new ErrorAgenda('El médico no está disponible.', 404)
  if (usuario.rol === 'medico' && data.usuario_id !== usuario.id) throw new ErrorAgenda('Solo puedes gestionar tu propia agenda.', 403)
  return data
}
export async function configuracionMedico(db: any, medico: any): Promise<{ bloques: BloqueAgenda[]; descansos: DescansoAgenda[] }> {
  const publicada = await db.from('configuracion_agenda').select('bloques,descansos').eq('medico_id', medico.id).maybeSingle()
  if (publicada.error && publicada.error.code !== 'PGRST205') throw Error('No se pudo leer la agenda publicada.')
  if (publicada.data) return { bloques: validarBloques(publicada.data.bloques), descansos: validarDescansos(publicada.data.descansos) }
  const archivo = await db.storage.from('agenda-medica').download(`${medico.id}/horario.json`)
  if (archivo.data) {
    const config = JSON.parse(await archivo.data.text())
    return { bloques: validarBloques(config.bloques), descansos: validarDescansos(config.descansos ?? []) }
  }
  if (archivo.error && !['400', '404'].includes(String(archivo.error.statusCode)) && !/not found|does not exist/i.test(archivo.error.message)) throw Error('No se pudo leer la configuración de horarios.')
  const authId = uno(medico.usuarios)?.auth_user_id
  if (authId) {
    const { data, error } = await db.auth.admin.getUserById(authId)
    if (error) throw Error('No se pudo verificar la configuración del médico.')
    if (data.user?.app_metadata?.clinica_agenda) return { bloques: validarBloques(data.user.app_metadata.clinica_agenda.bloques), descansos: validarDescansos(data.user.app_metadata.clinica_agenda.descansos ?? []) }
  }
  const { data, error } = await db.from('agenda_medicos').select('dia_semana,hora_inicio,hora_fin,duracion_slot').eq('medico_id', medico.id).eq('esta_activo', true)
  if (error && !['42P01', 'PGRST205'].includes(error.code)) throw Error('No se pudo leer el horario del médico. Vuelve a intentarlo.')
  return { bloques: validarBloques((data ?? []).map((b: any) => ({ dia: b.dia_semana, inicio: b.hora_inicio.slice(0, 5), fin: b.hora_fin.slice(0, 5), paso: b.duracion_slot }))), descansos: [] }
}
export async function guardarConfiguracionMedico(db: any, medicoId: number, config: { bloques: BloqueAgenda[]; descansos: DescansoAgenda[] }, usuarioId: number) {
  const { error } = await db.rpc('clinica_guardar_agenda', { p_medico: medicoId, p_bloques: config.bloques, p_descansos: config.descansos })
  if (error) throw new ErrorAgenda(error.code === 'PGRST202' ? 'El administrador debe completar la actualización de la base de datos.' : error.message, error.code === 'PGRST202' ? 503 : error.code === '23P01' ? 409 : error.code === '42501' ? 403 : 400)
}

export async function citasAgenda(db: any, medicoId: number, fecha: string) {
  const desde = instanteClinica(fecha, '00:00'), hasta = instanteClinica(sumarDias(fecha, 7), '00:00')
  const { data, error } = await db.from('citas').select('id,inicio,fin,estado,paciente_id').eq('medico_id', medicoId).in('estado', ['pendiente', 'confirmada', 'atendida']).lt('inicio', hasta).gt('fin', desde).order('inicio')
  if (error) throw Error('No se pudo verificar la ocupación de la agenda.')
  return data ?? []
}
export function fechaAgenda(valor: string | null) { const fecha = valor || fechaClinica(); try { instanteClinica(fecha, '00:00') } catch { throw new ErrorAgenda('Selecciona una fecha válida.') }; return fecha }
const proceso = globalThis as typeof globalThis & { colaCitas?: Promise<void> }
export async function operarCitas<T>(fn: () => Promise<T>): Promise<T> { const previa = proceso.colaCitas ?? Promise.resolve(); let liberar!: () => void; const actual = new Promise<void>((r) => { liberar = r }); proceso.colaCitas = actual; await previa.catch(() => {}); try { return await fn() } finally { liberar(); if (proceso.colaCitas === actual) delete proceso.colaCitas } }
