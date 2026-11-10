import { leerConsulta, escribirConsulta } from '@/lib/agenda/consulta'
import { fechaClinica, instanteClinica, sumarDias, horaClinica } from '@/lib/agenda/modelo'
import { leerFichaClinica } from '@/lib/pacientes/ficha-clinica'
import { createClient } from '@/lib/supabase/client'
import type { CitaAgendaMedico, MedicoPerfil, MedicamentoPrescrito, DiagnosticoCie10, SignosVitales } from './types'
import { cargarHistorialPaciente } from '@/lib/supabase/datos'

export const CATALOGO_CIE10 = [
  { codigo: 'I20.9', descripcion: 'Angina de pecho, no especificada' },
  { codigo: 'I20.0', descripcion: 'Angina inestable' },
  { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)' },
  { codigo: 'I25.1', descripcion: 'Enfermedad aterosclerótica del corazón' },
  { codigo: 'E11.9', descripcion: 'Diabetes mellitus tipo 2 sin mención de complicación' },
  { codigo: 'E78.5', descripcion: 'Hiperlipidemia, no especificada' },
  { codigo: 'R00.2', descripcion: 'Palpitaciones' },
  { codigo: 'R07.4', descripcion: 'Dolor en el pecho, no especificado' },
  { codigo: 'I50.9', descripcion: 'Insuficiencia cardíaca, no especificada' },
  { codigo: 'J44.9', descripcion: 'Enfermedad pulmonar obstructiva crónica, no especificada' },
  { codigo: 'K29.7', descripcion: 'Gastritis, no especificada' },
  { codigo: 'J00', descripcion: 'Rinofaringitis aguda (resfriado común)' },
]

export const VADEMECUM_POPULAR = [
  { nombre: 'Amlodipino 5 mg' },
  { nombre: 'Losartán Potásico 50 mg' },
  { nombre: 'Atorvastatina 20 mg' },
  { nombre: 'Metformina 850 mg' },
  { nombre: 'Aspirina Protect 100 mg' },
  { nombre: 'Bisoprolol 2.5 mg' },
  { nombre: 'Paracetamol 500 mg' },
  { nombre: 'Omeprazol 20 mg' },
]

export async function obtenerMedicosBD(): Promise<MedicoPerfil[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('perfiles_medicos')
      .select('id, especialidad, cedula_profesional, clinica_id, duracion_consulta, clinicas(nombre), usuarios(nombre_completo,esta_activo)')
      .eq('esta_activo', true)
      .order('id', { ascending: true })

    if (error || !data || data.length === 0) {
      if (error) throw Error('No se pudo consultar el directorio médico.')
      return []
    }

    return data.filter((item) => (Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios)?.esta_activo !== false).map((item) => {
      const usuario = Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios
      const clinica = Array.isArray(item.clinicas) ? item.clinicas[0] : item.clinicas
      const nombreLimpio = usuario?.nombre_completo || 'Médico'
      const prefijo = nombreLimpio.toLowerCase().startsWith('dr') ? '' : 'Dr. '
      return {
        id: item.id,
        nombre: `${prefijo}${nombreLimpio}`,
        especialidad: item.especialidad || 'Medicina General',
        cedula: item.cedula_profesional || 'No registrada',
        clinica: clinica?.nombre || 'Clínica no registrada',
        consultorio: '',
        duracionConsulta: item.duracion_consulta,
        clinicaId: item.clinica_id,
      }
    })
  } catch (err) {
    throw Error('No se pudo consultar el directorio médico.')
  }
}

export async function obtenerCitasAgendaMedico(medicoId: number, fechaStr = fechaClinica()): Promise<CitaAgendaMedico[]> {
  const db = createClient()
  const { data, error } = await db.from('citas').select('id,inicio,fin,estado,motivo,paciente_id,perfiles_pacientes(id,fecha_nacimiento,genero,notas_medicas,usuarios(nombre_completo))').eq('medico_id', medicoId).gte('inicio', instanteClinica(fechaStr, '00:00')).lt('inicio', instanteClinica(sumarDias(fechaStr, 1), '00:00')).order('inicio')
  if (error) throw Error('No se pudo cargar la agenda del médico. Vuelve a intentarlo.')
  const historiales = new Map<number, ReturnType<typeof cargarHistorialPaciente>>()
  return Promise.all((data ?? []).map(async (cita): Promise<CitaAgendaMedico> => {
    const uno = (v: any) => Array.isArray(v) ? v[0] : v
    const paciente = uno(cita.perfiles_pacientes), ficha = leerFichaClinica(paciente?.notas_medicas), vitales = ficha.signosVitales
    if (!historiales.has(cita.paciente_id)) historiales.set(cita.paciente_id, cargarHistorialPaciente(cita.paciente_id))
    const [historial, expediente] = await Promise.all([historiales.get(cita.paciente_id)!, db.from('expedientes').select('id,diagnostico,receta,notas_doctor').eq('cita_id', cita.id).maybeSingle()])
    if (expediente.error) throw Error('No se pudo cargar el expediente de una cita.')
    const anteriores = historial.filas.filter((h) => h.id !== expediente.data?.id && h.fechaIso && Date.parse(h.fechaIso) < Date.parse(cita.inicio))
    const edadFecha = fechaClinica(), nacimiento = paciente?.fecha_nacimiento
    const edad = nacimiento ? Number(edadFecha.slice(0, 4)) - Number(nacimiento.slice(0, 4)) - (edadFecha.slice(5) < nacimiento.slice(5) ? 1 : 0) : null
    const mapa: Record<string, CitaAgendaMedico['estado']> = { pendiente: 'pendiente', confirmada: 'confirmada', atendida: 'atendida', cancelada_paciente: 'cancelada', cancelada_medico: 'cancelada', no_asistio: 'cancelada' }
    return { id: cita.id, inicio: cita.inicio, fin: cita.fin, hora: horaClinica(cita.inicio), estado: mapa[cita.estado] ?? 'pendiente', tipoTurno: anteriores.length ? 'Recurrente' : 'Primera Consulta', pacienteId: cita.paciente_id, pacienteNombre: uno(paciente?.usuarios)?.nombre_completo ?? 'Paciente', expedienteFolio: expediente.data?.id ? `EXP-${String(expediente.data.id).padStart(5, '0')}` : 'Sin expediente de esta cita', expedienteId: expediente.data?.id, edad: edad !== null && edad >= 0 ? edad : null, genero: paciente?.genero, grupoSanguineo: ficha.tipoSangre || 'No registrado', ultimaVisita: anteriores[0]?.fechaIso, motivo: cita.motivo || 'Sin motivo registrado', alertas: [ficha.alergias ? `Alergias: ${ficha.alergias}` : '', ficha.condicionesCronicas ?? ''].filter(Boolean), signosVitales: vitales ? { presionArterial: vitales.presionArterial, frecuenciaCardiaca: vitales.frecuenciaCardiaca, spo2: vitales.saturacionOxigeno, temperatura: vitales.temperatura, peso: vitales.peso, fechaHora: vitales.fechaHora, tomadoPor: vitales.tomadoPor } : undefined, consultasPrevias: anteriores.map((h) => ({ id: String(h.id), fecha: h.fecha, especialidad: '', medico: h.medico, resumen: `${h.motivo}: ${h.diagnostico}. ${h.notas}` })), historialError: historial.error ?? undefined, medicamentosActivos: ficha.medicamentoActual ? [{ id: 'ficha', nombre: ficha.medicamentoActual, dosis: '', frecuencia: '', via: '', activo: true }] : [], ...leerConsulta(expediente.data) }
  }))
}

export async function finalizarConsultaYFirmar({
  citaId,
  soap,
  diagnosticos,
  prescripciones,
  signosVitales,
  concluir = true,
}: {
  citaId: number
  soap: { subjetivo: string; objetivo: string; plan: string }
  diagnosticos: DiagnosticoCie10[]
  prescripciones: MedicamentoPrescrito[]
  signosVitales?: SignosVitales
  concluir?: boolean
}): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const supabase = createClient()

    const contenido = escribirConsulta(soap, diagnosticos, prescripciones, signosVitales)

    // 4. Guardar en tabla expedientes de Supabase
    const { error: expError } = await supabase.from('expedientes').upsert(
      {
        cita_id: citaId,
        ...contenido,
      },
      { onConflict: 'cita_id' }
    )

    if (expError) {
      return { ok: false, mensaje: 'No se pudo guardar el expediente. La cita conserva su estado.' }
    }

    // 5. Actualizar estado de la cita a 'atendida' en Supabase
    if (!concluir) { window.dispatchEvent(new Event('datos-actualizados')); return { ok: true, mensaje: 'Borrador guardado en el expediente. La cita sigue pendiente de finalizar.' } }
    const { data: citaActualizada, error: citaError } = await supabase
      .from('citas')
      .update({
        estado: 'atendida',
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', citaId).select('id').maybeSingle()

    if (citaError || !citaActualizada) {
      return { ok: false, mensaje: 'El expediente se guardó, pero no se pudo finalizar la cita. Revisa su estado antes de volver a intentarlo.' }
    }

    // Disparar evento global para que recepcionista, médico y admin se actualicen inmediatamente
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    return { ok: true, mensaje: 'Consulta guardada y finalizada correctamente.' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido al guardar'
    return { ok: false, mensaje: msg }
  }
}
