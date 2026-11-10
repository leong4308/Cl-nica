import { NextResponse } from 'next/server'
import { accesoAgenda, configuracionMedico, ErrorAgenda, errorAgenda, idAgenda, medicoAgenda, operarCitas, uno } from '@/lib/agenda/servidor'
import { instanteClinica, intervaloDescanso, ocupaAgenda, resumirAgenda, seCruzan, sumarDias } from '@/lib/agenda/modelo'
import { origenValido } from '@/lib/cuenta/servidor'
export async function POST(request: Request) {
  try { if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
    const acceso = await accesoAgenda(); if (acceso.respuesta) return acceso.respuesta
    if (!['admin', 'recepcionista', 'medico'].includes(acceso.usuario.rol)) return NextResponse.json({ error: 'No puedes agendar citas.' }, { status: 403 })
    const body = await request.json()
    if (!body || typeof body !== 'object') throw new ErrorAgenda('Revisa los datos de la cita.')
    const pacienteId = idAgenda(body.pacienteId), medicoId = idAgenda(body.medicoId), medico = await medicoAgenda(acceso.admin, medicoId, acceso.usuario)
    let inicio: string
    try { inicio = instanteClinica(body.fecha, body.hora) } catch { throw new ErrorAgenda('Selecciona una fecha y hora válidas.') }
    if (Date.parse(inicio) <= Date.now()) throw new ErrorAgenda('El horario ya transcurrió. Selecciona uno posterior.')
    const duracion = medico.duracion_consulta
    if (!Number.isInteger(duracion) || duracion < 5 || duracion > 240) throw new ErrorAgenda('Revisa la duración de consulta del médico.')
    const fin = new Date(Date.parse(inicio) + duracion * 60000).toISOString()
    if (Date.parse(fin) > Date.parse(instanteClinica(sumarDias(body.fecha, 1), '00:00'))) throw new ErrorAgenda('La cita debe terminar dentro del mismo día.')
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''
    if (!motivo || motivo.length > 2000) throw new ErrorAgenda('Escribe un motivo de hasta 2000 caracteres.')
    return await operarCitas(async () => {
      const paciente = await acceso.admin.from('perfiles_pacientes').select('id,esta_activo,usuarios(esta_activo)').eq('id', pacienteId).maybeSingle()
      if (paciente.error) throw Error('No se pudo verificar al paciente.')
      if (!paciente.data?.esta_activo || !uno(paciente.data.usuarios)?.esta_activo) throw new ErrorAgenda('Selecciona un paciente activo.')
      const [config, reservas] = await Promise.all([configuracionMedico(acceso.admin, medico), acceso.admin.from('citas').select('id,inicio,fin,estado,medico_id,paciente_id').or(`medico_id.eq.${medicoId},paciente_id.eq.${pacienteId}`).in('estado', ['pendiente', 'confirmada', 'atendida']).lt('inicio', fin).gt('fin', inicio).limit(1)])
      if (reservas.error) throw Error('No se pudo verificar la disponibilidad. No se guardó la cita.')
      const choque = reservas.data?.filter(ocupaAgenda).find((c) => seCruzan(c, { inicio, fin }))
      if (choque) throw new ErrorAgenda(choque.medico_id === medicoId ? 'El médico ya tiene una cita en ese intervalo. Actualiza los horarios.' : 'El paciente ya tiene otra cita que coincide con ese intervalo.', 409)
      if (config.descansos.some((d) => seCruzan(intervaloDescanso(d), { inicio, fin }))) throw new ErrorAgenda('El médico tiene un descanso asignado en ese intervalo. Selecciona otra hora.', 409)
      if (config.bloques.length && !resumirAgenda(config.bloques, [], body.fecha, duracion).dias[0].slots.some((s) => s.inicio === inicio)) throw new ErrorAgenda('El intervalo no corresponde al horario configurado del médico.', 409)
      const { data, error } = await acceso.admin.from('citas').insert({ medico_id: medicoId, paciente_id: pacienteId, clinica_id: medico.clinica_id, inicio, fin, motivo, estado: 'pendiente' }).select('id').single()
      if (error || !data) { if (error?.code === '23P01') throw new ErrorAgenda('Ese horario acaba de ocuparse. Selecciona otro.', 409); throw Error('No se pudo guardar la cita. Vuelve a intentarlo.') }
      return NextResponse.json({ id: data.id, inicio, fin })
    })
  } catch (err) { return errorAgenda(err) }
}
