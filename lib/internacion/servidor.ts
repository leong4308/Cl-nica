import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cuentaAutenticada } from '@/lib/cuenta/servidor'
import { limpiarCama, limpiarHabitacion, type CamaHospital, type DatosHospital, type IngresoHospital } from './modelo'

export class ErrorHospital extends Error { constructor(message: string, public status = 400) { super(message) } }
export function respuestaErrorHospital(error: unknown) { return NextResponse.json({ error: error instanceof SyntaxError ? 'Los datos enviados no son válidos.' : error instanceof Error ? error.message : 'No se pudo completar la operación.' }, { status: error instanceof ErrorHospital ? error.status : error instanceof SyntaxError ? 400 : 500 }) }
export async function accesoHospital() {
  const acceso = await cuentaAutenticada()
  if (acceso.respuesta) return { respuesta: acceso.respuesta } as const
  if (!['admin', 'medico', 'enfermero'].includes(acceso.usuario.rol)) return { respuesta: NextResponse.json({ error: 'No tienes permiso para gestionar hospitalizaciones.' }, { status: 403 }) } as const
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('No se pudo conectar con el servicio de hospitalización.')
  return { ...acceso, admin: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) }
}
export const SELECCION_INGRESO = 'id,paciente_id,medico_responsable_id,clinica_id,habitacion_id,cama_id,fecha_ingreso,fecha_alta,estado,motivo_ingreso,diagnostico_ingreso,actualizado_en,habitaciones(numero,tipo),camas(numero),perfiles_pacientes(usuarios(nombre_completo)),perfiles_medicos(usuarios(nombre_completo))'
const uno = (relacion: any) => Array.isArray(relacion) ? relacion[0] : relacion
export function mapearIngreso(fila: any): IngresoHospital {
  return { id: fila.id, pacienteId: fila.paciente_id, paciente: uno(uno(fila.perfiles_pacientes)?.usuarios)?.nombre_completo ?? 'Paciente', medicoId: fila.medico_responsable_id, medico: uno(uno(fila.perfiles_medicos)?.usuarios)?.nombre_completo ?? 'Sin médico', clinicaId: fila.clinica_id, habitacionId: fila.habitacion_id, habitacion: limpiarHabitacion(uno(fila.habitaciones)?.numero ?? ''), tipoHabitacion: uno(fila.habitaciones)?.tipo ?? '', camaId: fila.cama_id, cama: limpiarCama(uno(fila.camas)?.numero ?? ''), ingreso: fila.fecha_ingreso, alta: fila.fecha_alta, estado: fila.estado, motivo: fila.motivo_ingreso ?? '', diagnostico: fila.diagnostico_ingreso ?? '', version: fila.actualizado_en }
}
export async function datosHospital(db: SupabaseClient): Promise<DatosHospital> {
  const [ingresos, camas, pacientes, medicos] = await Promise.all([
    db.from('internaciones').select(SELECCION_INGRESO).order('fecha_ingreso', { ascending: false }).limit(1000),
    db.from('camas').select('id,numero,habitacion_id,esta_ocupada,habitaciones(numero,tipo,clinica_id)').order('id'),
    db.from('perfiles_pacientes').select('id,usuarios(nombre_completo,esta_activo)').eq('esta_activo', true).limit(1000),
    db.from('perfiles_medicos').select('id,especialidad,clinica_id,usuarios(nombre_completo,esta_activo)').eq('esta_activo', true).limit(1000),
  ])
  if ([ingresos, camas, pacientes, medicos].some((res) => res.error)) throw Error('No se pudieron cargar las hospitalizaciones y la disponibilidad.')
  const filas = (ingresos.data ?? []).map(mapearIngreso)
  const activas = filas.filter((fila) => fila.estado === 'activa')
  return {
    ingresos: filas,
    camas: (camas.data ?? []).map((c): CamaHospital => { const actual = activas.find((i) => i.camaId === c.id); const habitacion = uno(c.habitaciones); return { id: c.id, habitacionId: c.habitacion_id, clinicaId: habitacion?.clinica_id, numero: limpiarCama(c.numero), habitacion: limpiarHabitacion(habitacion?.numero ?? ''), tipo: habitacion?.tipo ?? 'General', ocupada: Boolean(actual || c.esta_ocupada), paciente: actual?.paciente ?? null, internacionId: actual?.id ?? null, inconsistente: Boolean(c.esta_ocupada) !== Boolean(actual) } }),
    pacientes: (pacientes.data ?? []).filter((p) => uno(p.usuarios)?.esta_activo !== false).map((p) => ({ id: p.id, nombre: uno(p.usuarios)?.nombre_completo ?? 'Paciente', ingresoActivo: activas.some((i) => i.pacienteId === p.id) })),
    medicos: (medicos.data ?? []).filter((m) => uno(m.usuarios)?.esta_activo !== false).map((m) => ({ id: m.id, nombre: uno(m.usuarios)?.nombre_completo ?? 'Médico', especialidad: m.especialidad, clinicaId: m.clinica_id })),
  }
}

// Serializa las operaciones del servidor; la reserva de cada cama también usa un UPDATE condicional en la base.
const proceso = globalThis as typeof globalThis & { colaHospital?: Promise<void> }
export async function operarHospital<T>(operacion: () => Promise<T>): Promise<T> {
  const anterior = proceso.colaHospital ?? Promise.resolve()
  let liberar!: () => void
  const actual = new Promise<void>((resolve) => { liberar = resolve })
  proceso.colaHospital = actual
  await anterior.catch(() => {})
  try { return await operacion() } finally { liberar(); if (proceso.colaHospital === actual) delete proceso.colaHospital }
}
export function idHospital(valor: unknown): number {
  if ((typeof valor !== 'number' && typeof valor !== 'string') || !/^\d+$/.test(String(valor).trim())) throw new ErrorHospital('Selecciona un registro válido.')
  const id = Number(valor)
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorHospital('Selecciona un registro válido.')
  return id
}
export function textoHospital(valor: unknown, nombre: string, requerido = false): string {
  if (valor !== undefined && valor !== null && typeof valor !== 'string') throw new ErrorHospital(`Revisa ${nombre}.`)
  const texto = typeof valor === 'string' ? valor.trim() : ''
  if ((requerido && !texto) || texto.length > 8000) throw new ErrorHospital(`Revisa ${nombre}; ${requerido ? 'es obligatorio y ' : ''}admite hasta 8000 caracteres.`)
  return texto
}
export async function reservarCama(db: SupabaseClient, id: number) {
  const { data: ocupacion, error: errorConsulta } = await db.from('internaciones').select('id').eq('cama_id', id).eq('estado', 'activa').limit(1).maybeSingle()
  if (errorConsulta) throw Error('No se pudo verificar la cama.')
  if (ocupacion) throw new ErrorHospital('La cama ya está ocupada. Elige otra cama.', 409)
  const { data, error } = await db.from('camas').update({ esta_ocupada: true }).eq('id', id).eq('esta_ocupada', false).select('id').maybeSingle()
  if (error || !data) throw new ErrorHospital('La cama dejó de estar disponible. Actualiza las opciones.', 409)
}
export async function liberarCama(db: SupabaseClient, id: number): Promise<boolean> {
  const { data: activa, error: errorConsulta } = await db.from('internaciones').select('id').eq('cama_id', id).eq('estado', 'activa').limit(1).maybeSingle()
  if (errorConsulta || activa) return false
  const { data, error } = await db.from('camas').update({ esta_ocupada: false }).eq('id', id).select('id').maybeSingle()
  return !error && Boolean(data)
}
export async function validarResponsableCama(db: SupabaseClient, medicoId: number, camaId: number) {
  const [medico, cama] = await Promise.all([
    db.from('perfiles_medicos').select('id,clinica_id,esta_activo,usuarios(esta_activo)').eq('id', medicoId).maybeSingle(),
    db.from('camas').select('id,habitacion_id,numero,habitaciones(numero,clinica_id)').eq('id', camaId).maybeSingle(),
  ])
  if (medico.error || cama.error) throw Error('No se pudo verificar el médico y la cama.')
  if (!medico.data?.esta_activo || uno(medico.data.usuarios)?.esta_activo === false || !cama.data) throw new ErrorHospital('El médico o la cama no están disponibles.')
  const habitacion = uno(cama.data.habitaciones)
  if (!habitacion || habitacion.clinica_id !== medico.data.clinica_id) throw new ErrorHospital('El médico y la cama deben pertenecer a la misma clínica.')
  return { clinicaId: habitacion.clinica_id, habitacionId: cama.data.habitacion_id, cama: cama.data }
}
