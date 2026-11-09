import type { SupabaseClient } from '@supabase/supabase-js'
import { ubicacionHospital } from './modelo'
import { ErrorHospital, idHospital, liberarCama, reservarCama, textoHospital, validarResponsableCama } from './servidor'

type Actor = { id: number; nombre_completo: string }
type Resultado = { id: number; advertencia?: string }
async function evento(db: SupabaseClient, ingresoId: number, medicoId: number, actor: Actor, tipo: string, descripcion: string): Promise<number> {
  const { data, error } = await db.from('episodios_medicos').insert({ internacion_id: ingresoId, medico_id: medicoId, tipo_episodio: tipo, descripcion, otros_signos: { auditoria: { usuarioId: actor.id, nombre: actor.nombre_completo } } }).select('id').single()
  if (error || !data) throw Error('No se pudo registrar el movimiento de hospitalización.')
  return data.id
}
export async function crearIngreso(db: SupabaseClient, body: any, actor: Actor): Promise<Resultado> {
  const pacienteId = idHospital(body.pacienteId), medicoId = idHospital(body.medicoId), camaId = idHospital(body.camaId)
  const motivo = textoHospital(body.motivo, 'el motivo de ingreso', true), diagnostico = textoHospital(body.diagnostico, 'el diagnóstico de ingreso')
  const [paciente, activa] = await Promise.all([
    db.from('perfiles_pacientes').select('id,esta_activo,usuarios(esta_activo)').eq('id', pacienteId).maybeSingle(),
    db.from('internaciones').select('id').eq('paciente_id', pacienteId).eq('estado', 'activa').limit(1).maybeSingle(),
  ])
  if (paciente.error || activa.error) throw Error('No se pudo verificar el paciente.')
  const usuario = Array.isArray(paciente.data?.usuarios) ? paciente.data.usuarios[0] : paciente.data?.usuarios
  if (!paciente.data?.esta_activo || usuario?.esta_activo === false) throw new ErrorHospital('Selecciona un paciente activo.')
  if (activa.data) throw new ErrorHospital('El paciente ya tiene una hospitalización activa.', 409)
  const ubicacion = await validarResponsableCama(db, medicoId, camaId)
  await reservarCama(db, camaId)
  let ingresoId: number | undefined
  try {
    const { data, error } = await db.from('internaciones').insert({ paciente_id: pacienteId, medico_responsable_id: medicoId, clinica_id: ubicacion.clinicaId, habitacion_id: ubicacion.habitacionId, cama_id: camaId, motivo_ingreso: motivo, diagnostico_ingreso: diagnostico || null, estado: 'activa' }).select('id').single()
    if (error || !data) throw Error('No se pudo registrar el ingreso.')
    ingresoId = data.id
    await evento(db, data.id, medicoId, actor, 'Ingreso', `Motivo: ${motivo}${diagnostico ? `\nDiagnóstico de ingreso: ${diagnostico}` : ''}`)
    return { id: data.id }
  } catch (error) {
    if (ingresoId) {
      const eliminado = await db.from('internaciones').delete().eq('id', ingresoId).select('id').maybeSingle()
      if (eliminado.error || !eliminado.data) throw Error('El ingreso quedó pendiente de revisión. Actualiza el listado antes de volver a registrarlo.')
    }
    if (!await liberarCama(db, camaId)) throw Error('No se pudo registrar el ingreso y la reserva de cama requiere revisión en el mapa de camas.')
    throw error
  }
}
export async function modificarIngreso(db: SupabaseClient, anterior: any, body: any, actor: Actor): Promise<Resultado> {
  if (typeof body.version !== 'string' || body.version !== anterior.actualizado_en) throw new ErrorHospital('El ingreso cambió. Vuelve a abrirlo antes de guardar.', 409)
  const accion = body.accion
  if (accion !== 'editar' && accion !== 'alta') throw new ErrorHospital('Acción de hospitalización inválida.')
  const ahora = new Date(Math.max(Date.now(), Date.parse(anterior.actualizado_en) + 1)).toISOString()
  let cambios: Record<string, unknown>, tipo: string, descripcion: string, camaNueva: number | undefined
  if (accion === 'alta') {
    if (anterior.estado !== 'activa') throw new ErrorHospital('Este ingreso ya está cerrado. No se puede volver a dar de alta.', 409)
    if (body.confirmado !== true) throw new ErrorHospital('Confirma el alta y la liberación de la cama.')
    const nota = textoHospital(body.notaAlta, 'la nota de egreso', true)
    cambios = { estado: 'alta', fecha_alta: ahora, actualizado_en: ahora }
    tipo = 'Alta'; descripcion = nota
  } else {
    const medicoId = idHospital(body.medicoId), camaId = idHospital(body.camaId)
    const motivo = textoHospital(body.motivo, 'el motivo de ingreso', true), diagnostico = textoHospital(body.diagnostico, 'el diagnóstico de ingreso')
    const nota = textoHospital(body.notaCambio, 'la nota del cambio', anterior.estado !== 'activa')
    if (anterior.estado !== 'activa' && camaId !== anterior.cama_id) throw new ErrorHospital('No se puede reasignar la cama de un ingreso cerrado.')
    let habitacionId = anterior.habitacion_id
    let traslado = ''
    if (medicoId !== anterior.medico_responsable_id || camaId !== anterior.cama_id) {
      const ubicacion = await validarResponsableCama(db, medicoId, camaId)
      if (ubicacion.clinicaId !== anterior.clinica_id) throw new ErrorHospital('La edición debe conservar la clínica del ingreso.')
      habitacionId = ubicacion.habitacionId
      const uno = (valor: any) => Array.isArray(valor) ? valor[0] : valor
      traslado = `Traslado de ${ubicacionHospital(uno(anterior.habitaciones)?.numero ?? '—', uno(anterior.camas)?.numero ?? '—')} a ${ubicacionHospital(uno(ubicacion.cama.habitaciones)?.numero ?? '—', ubicacion.cama.numero)}.`
    }
    cambios = { medico_responsable_id: medicoId, cama_id: camaId, habitacion_id: habitacionId, motivo_ingreso: motivo, diagnostico_ingreso: diagnostico || null, actualizado_en: ahora }
    tipo = anterior.estado !== 'activa' ? 'Corrección de registro' : camaId !== anterior.cama_id ? 'Traslado de cama' : 'Actualización'
    const lineas = [nota]
    if (camaId !== anterior.cama_id) lineas.push(traslado)
    if (medicoId !== anterior.medico_responsable_id) lineas.push('Se actualizó el médico responsable.')
    if (motivo !== anterior.motivo_ingreso) lineas.push(`Motivo anterior: ${anterior.motivo_ingreso || 'Sin registrar'}\nMotivo actualizado: ${motivo}`)
    if (diagnostico !== (anterior.diagnostico_ingreso ?? '')) lineas.push(`Diagnóstico anterior: ${anterior.diagnostico_ingreso || 'Sin registrar'}\nDiagnóstico actualizado: ${diagnostico || 'Sin registrar'}`)
    descripcion = lineas.filter(Boolean).join('\n') || 'Revisión de los datos de hospitalización.'
    if (camaId !== anterior.cama_id) { await reservarCama(db, camaId); camaNueva = camaId }
  }
  let eventoId: number | undefined
  try {
    eventoId = await evento(db, anterior.id, Number(cambios.medico_responsable_id ?? anterior.medico_responsable_id), actor, tipo, descripcion)
    const { data, error } = await db.from('internaciones').update(cambios).eq('id', anterior.id).eq('actualizado_en', anterior.actualizado_en).eq('estado', anterior.estado).select('id').maybeSingle()
    if (error || !data) throw new ErrorHospital('No se pudo guardar: el ingreso cambió durante la operación. Actualiza sus datos.', 409)
  } catch (error) {
    let pendiente = false
    if (eventoId) {
      const limpieza = await db.from('episodios_medicos').delete().eq('id', eventoId).select('id').maybeSingle()
      pendiente = Boolean(limpieza.error || !limpieza.data)
    }
    if (camaNueva && !await liberarCama(db, camaNueva)) pendiente = true
    if (pendiente) throw Error('No se pudo guardar y quedaron movimientos o reservas pendientes de revisión. Actualiza el ingreso y el mapa de camas antes de volver a intentarlo.')
    throw error
  }
  if (accion === 'alta' || camaNueva) {
    const liberada = await liberarCama(db, anterior.cama_id)
    if (!liberada) return { id: anterior.id, advertencia: 'El cambio quedó guardado, pero la ocupación de la cama anterior requiere revisión. Un administrador puede actualizar la ocupación desde el mapa de camas.' }
  }
  return { id: anterior.id }
}
export async function sincronizarOcupacion(db: SupabaseClient): Promise<number> {
  const [camas, activas] = await Promise.all([db.from('camas').select('id,esta_ocupada'), db.from('internaciones').select('cama_id').eq('estado', 'activa')])
  if (camas.error || activas.error) throw Error('No se pudo revisar la ocupación.')
  const ocupadas = new Set((activas.data ?? []).map((fila) => fila.cama_id))
  let corregidas = 0
  for (const cama of camas.data ?? []) {
    const ocupada = ocupadas.has(cama.id)
    if (ocupada === cama.esta_ocupada) continue
    const { data, error } = await db.from('camas').update({ esta_ocupada: ocupada }).eq('id', cama.id).eq('esta_ocupada', cama.esta_ocupada).select('id').maybeSingle()
    if (error || !data) throw Error('No se pudo completar la actualización de ocupación. Vuelve a revisar el mapa.')
    corregidas++
  }
  return corregidas
}
