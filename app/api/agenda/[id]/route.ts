import { NextResponse } from 'next/server'
import { accesoAgenda, configuracionMedico, citasAgenda, ErrorAgenda, errorAgenda, operarCitas, fechaAgenda, idAgenda, medicoAgenda, guardarConfiguracionMedico } from '@/lib/agenda/servidor'
import { instanteClinica, intervaloDescanso, ocupaAgenda, resumirAgenda, seCruzan, sumarDias, validarBloques, validarDescansos } from '@/lib/agenda/modelo'
import { origenValido } from '@/lib/cuenta/servidor'
type Contexto = { params: Promise<{ id: string }> }
export async function GET(request: Request, contexto: Contexto) {
  try { const acceso = await accesoAgenda(); if (acceso.respuesta) return acceso.respuesta
    const id = idAgenda((await contexto.params).id), fecha = fechaAgenda(new URL(request.url).searchParams.get('fecha'))
    const medico = await medicoAgenda(acceso.admin, id, acceso.usuario)
    const [config, citas] = await Promise.all([configuracionMedico(acceso.admin, medico), citasAgenda(acceso.admin, id, fecha)])
    return NextResponse.json(resumirAgenda(config.bloques, citas, fecha, medico.duracion_consulta, new Date(), 7, config.descansos), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) { return errorAgenda(err) }
}
export async function PATCH(request: Request, contexto: Contexto) {
  try { if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
    const acceso = await accesoAgenda(); if (acceso.respuesta) return acceso.respuesta
    if (acceso.usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo administración puede configurar horarios.' }, { status: 403 })
    const id = idAgenda((await contexto.params).id), medico = await medicoAgenda(acceso.admin, id, acceso.usuario), body = await request.json()
    let bloques
    try { bloques = validarBloques(body?.bloques) } catch (err) { throw new ErrorAgenda(err instanceof Error ? err.message : 'Revisa los bloques.') }
    return await operarCitas(async () => {
    const anterior = await configuracionMedico(acceso.admin, medico)
    let descansos
    try { descansos = validarDescansos(body.descansos ?? anterior.descansos ?? []) } catch (err) { throw new ErrorAgenda(err instanceof Error ? err.message : 'Revisa los descansos.') }
    // Se consulta la unión exacta de los descansos, en grupos pequeños para no superar la longitud de la URL.
    for (let i = 0; i < descansos.length; i += 15) {
      const condiciones = descansos.slice(i, i + 15).map((d) => { const rango = intervaloDescanso(d); return `and(inicio.lt.${rango.fin},fin.gt.${rango.inicio})` }).join(',')
      const reservadas = await acceso.admin.from('citas').select('id,inicio,fin,estado').eq('medico_id', id).in('estado', ['pendiente', 'confirmada', 'atendida']).or(condiciones).limit(1)
      if (reservadas.error) throw Error('No se pudieron verificar las citas antes de asignar los descansos.')
      const conflicto = (reservadas.data ?? []).find((c) => descansos.some((d) => seCruzan(c, intervaloDescanso(d))))
      if (conflicto) return NextResponse.json({ error: `El descanso coincide con la cita #${conflicto.id}. Reagenda esa cita antes de asignarlo.` }, { status: 409 })
    }
    await guardarConfiguracionMedico(acceso.db, id, { bloques, descansos }, acceso.usuario.id)
    return NextResponse.json({ ok: true })
    })
  } catch (err) { return errorAgenda(err) }
}
