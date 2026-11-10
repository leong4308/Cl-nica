import type { SupabaseClient } from '@supabase/supabase-js'

type Solicitante = { id: number; rol: string }
export type PacienteListado = {
  id: number; esta_activo: boolean; fecha_nacimiento: string | null; genero: string | null; notas_medicas: string | null
  usuarios: { nombre_completo: string; correo?: string | null; telefono: string | null } | { nombre_completo: string; correo?: string | null; telefono: string | null }[] | null
}
const uno = (valor: any) => Array.isArray(valor) ? valor[0] : valor

async function todasLasFilas(consulta: (desde: number, hasta: number) => PromiseLike<{ data: any[] | null; error: unknown }>) {
  const filas: any[] = []
  for (let desde = 0; ; desde += 500) {
    const resultado = await consulta(desde, desde + 499)
    if (resultado.error) throw Error('No se pudo verificar la relación entre pacientes y médicos.')
    filas.push(...(resultado.data ?? []))
    if ((resultado.data?.length ?? 0) < 500) return filas
  }
}

export async function pacientesDelMedico(db: SupabaseClient, usuarioId: number): Promise<{ ids: number[]; nombre: string }> {
  const { data: medico, error } = await db.from('perfiles_medicos').select('id,usuarios(nombre_completo)').eq('usuario_id', usuarioId).eq('esta_activo', true).maybeSingle()
  if (error) throw Error('No se pudo verificar el perfil del médico.')
  if (!medico) return { ids: [], nombre: '' }
  const [citas, internaciones, asignaciones] = await Promise.all([
    todasLasFilas((desde, hasta) => db.from('citas').select('id,paciente_id').eq('medico_id', medico.id).in('estado', ['pendiente', 'confirmada', 'atendida']).order('id').range(desde, hasta)),
    todasLasFilas((desde, hasta) => db.from('internaciones').select('id,paciente_id').eq('medico_responsable_id', medico.id).order('id').range(desde, hasta)),
    db.from('paciente_medicos').select('paciente_id,activo').eq('medico_id', medico.id),
  ])
  if (asignaciones.error && asignaciones.error.code !== 'PGRST205') throw Error('No se pudieron verificar los médicos tratantes.')
  const ids = new Set<number>([...citas, ...internaciones].map(r => Number(r.paciente_id)))
  for (const a of asignaciones.data ?? []) { if (a.activo) ids.add(a.paciente_id); else ids.delete(a.paciente_id) }
  return { ids: [...ids].filter((id) => Number.isSafeInteger(id) && id > 0), nombre: uno(medico.usuarios)?.nombre_completo ?? 'Médico tratante' }
}

export async function listarPacientes(db: SupabaseClient, solicitante: Solicitante): Promise<PacienteListado[]> {
  let ids: number[] | null = null
  if (solicitante.rol === 'medico') ids = (await pacientesDelMedico(db, solicitante.id)).ids
  if (ids?.length === 0) return []
  const resultado: PacienteListado[] = []
  // Filtra en la consulta, antes de paginar; los pacientes propios pueden estar al final del directorio.
  const grupos = ids ? Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids!.slice(i * 100, (i + 1) * 100)) : [null]
  for (const grupo of grupos) {
    const filas = await todasLasFilas((desde, hasta) => {
      let q = db.from('perfiles_pacientes').select('id,esta_activo,fecha_nacimiento,genero,notas_medicas,usuarios(nombre_completo,correo,telefono)').order('id')
      if (grupo) q = q.in('id', grupo)
      return q.range(desde, hasta)
    })
    resultado.push(...filas)
  }
  return resultado.sort((a, b) => a.id - b.id)
}
