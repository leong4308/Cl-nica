import { leerAgendaMedico } from '@/lib/agenda/modelo'
import { consultarHospital, guardarHospital, ubicacionHospital, type IngresoHospital } from '@/lib/internacion/modelo'
import { createClient } from './client'
import type { Row } from '@/components/modulos/compartidos/types'

type Resultado<T> = { filas: T[]; error: string | null }

export async function consultar<T>(consulta: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Resultado<T>> {
  const { data, error } = (await consulta) as { data: T[] | null; error: { message: string } | null }
  if (error) return { filas: [], error: error.message }
  return { filas: data ?? [], error: null }
}

const nombreDe = (relacion: unknown): string => {
  if (!relacion || typeof relacion !== 'object') return '—'
  const valor = relacion as { nombre_completo?: string }
  return valor.nombre_completo ?? '—'
}

export function horaDe(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    let h = d.getHours()
    const m = d.getMinutes().toString().padStart(2, '0')
    const periodo = h >= 12 ? 'PM' : 'AM'
    const hora12 = h % 12 === 0 ? 12 : h % 12
    return `${hora12}:${m} ${periodo}`
  } catch {
    return ''
  }
}
const fechaDe = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

const ETIQUETA_ESTADO_CITA: Record<string, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', atendida: 'Atendida',
  cancelada_paciente: 'Cancelada por paciente', cancelada_medico: 'Cancelada por médico', no_asistio: 'No asistió',
}
const ETIQUETA_ESTADO_ORDEN: Record<string, string> = {
  prescrita: 'Pendiente', en_proceso: 'En proceso', realizada: 'Completada', cancelada: 'Cancelada',
}
const ETIQUETA_ESTADO_INTERNACION: Record<string, string> = { activa: 'Ocupada', alta: 'Alta', traslado: 'Traslado' }

type PacienteCitaRelacion = {
  id?: number
  esta_activo?: boolean
  fecha_nacimiento?: string | null
  genero?: string | null
  usuarios: { nombre_completo: string; correo?: string | null; telefono?: string | null } | { nombre_completo: string; correo?: string | null; telefono?: string | null }[] | null
}

type CitaFila = {
  id: number; inicio: string; fin?: string; estado: string; motivo: string | null; motivo_cancelacion: string | null
  paciente_id: number
  perfiles_pacientes: PacienteCitaRelacion | PacienteCitaRelacion[] | null
  perfiles_medicos: MedicoRelacion | MedicoRelacion[] | null
}
type MedicoRelacion = {
  id: number
  duracion_consulta: number
  usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null
}

export async function cargarCitas(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<CitaFila>(
    supabase.from('citas')
      .select('id, inicio, fin, estado, motivo, paciente_id, perfiles_pacientes(id, esta_activo, fecha_nacimiento, genero, usuarios(nombre_completo, correo, telefono)), perfiles_medicos(usuarios(nombre_completo))')
      .order('inicio', { ascending: true })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((cita) => {
      const medicoRel = cita.perfiles_medicos
      const medico: MedicoRelacion | null = Array.isArray(medicoRel) ? (medicoRel[0] ?? null) : medicoRel
      const pacRel = cita.perfiles_pacientes
      const pac: PacienteCitaRelacion | null = Array.isArray(pacRel) ? (pacRel[0] ?? null) : pacRel
      const pacUsr = Array.isArray(pac?.usuarios) ? (pac?.usuarios[0] ?? null) : (pac?.usuarios ?? null)
      return [
        horaDe(cita.inicio),
        nombreDe(pac?.usuarios),
        nombreDe(medico?.usuarios),
        cita.motivo ?? 'Consulta general',
        ETIQUETA_ESTADO_CITA[cita.estado] ?? cita.estado,
        String(cita.id),
        cita.inicio,
        cita.fin ?? cita.inicio,
        String(cita.paciente_id ?? pac?.id ?? ''),
        cita.estado,
        pac?.genero ?? '',
        pac?.fecha_nacimiento ? fechaDe(pac.fecha_nacimiento) : '—',
        pacUsr?.telefono ?? '—',
        pac?.esta_activo !== false ? 'Activo' : 'Inactivo',
        pacUsr?.correo ?? '',
      ]
    }),
  }
}

export type CitaPanel = {
  id: number
  pacienteId: number
  medicoId: number
  duracionConsulta: number
  fecha: string
  hora: string
  paciente: string
  medico: string
  motivo: string
  motivoCancelacion: string | null
  solicitaReagenda: boolean
  reagendadaPorRecepcion?: boolean
  estado: string
  inicio: number
}

function inicioDiaLocal(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString()
}

const DIAS_VENTANA_PANEL = 7

export async function cargarCitasPanel(): Promise<{ filas: CitaPanel[]; error: string | null }> {
  const supabase = createClient()
  const hoy = new Date()
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + DIAS_VENTANA_PANEL)
  const { filas, error } = await consultar<CitaFila>(
    supabase.from('citas')
      .select('id, inicio, estado, motivo, motivo_cancelacion, paciente_id, perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(id, duracion_consulta, usuarios(nombre_completo))')
      .order('inicio', { ascending: true })
      .gte('inicio', inicioDiaLocal(hoy))
      .lt('inicio', inicioDiaLocal(fin))
      .limit(100)
  )
  return {
    error,
    filas: filas.map((cita) => {
      const medicoRel = cita.perfiles_medicos
      const medico: MedicoRelacion | null = Array.isArray(medicoRel) ? (medicoRel[0] ?? null) : medicoRel
      const usuarioMedico = medico?.usuarios
      const nombreMedico = Array.isArray(usuarioMedico) ? usuarioMedico[0]?.nombre_completo : usuarioMedico?.nombre_completo
      const pacRel = Array.isArray(cita.perfiles_pacientes) ? cita.perfiles_pacientes[0] : cita.perfiles_pacientes
      return {
        id: cita.id,
        pacienteId: cita.paciente_id,
        medicoId: medico?.id ?? 0,
        duracionConsulta: medico?.duracion_consulta ?? 20,
        fecha: aIso(fechaLocal(new Date(cita.inicio).toLocaleDateString('en-CA'))),
        hora: horaDe(cita.inicio),
        paciente: nombreDe(pacRel?.usuarios),
        medico: nombreMedico ?? '—',
        motivo: cita.motivo ?? 'Sin motivo',
        motivoCancelacion: cita.motivo_cancelacion ?? null,
        solicitaReagenda: Boolean(
          cita.motivo_cancelacion &&
          cita.motivo_cancelacion.toLowerCase().includes('reagenda') &&
          !cita.motivo_cancelacion.toLowerCase().includes('por recepción')
        ),
        reagendadaPorRecepcion: Boolean(
          cita.motivo_cancelacion &&
          cita.motivo_cancelacion.toLowerCase().includes('reagendada por recepción')
        ),
        estado: ETIQUETA_ESTADO_CITA[cita.estado] ?? cita.estado,
        inicio: new Date(cita.inicio).getTime(),
      }
    }),
  }
}

export type EstadoCita = 'pendiente' | 'confirmada' | 'atendida' | 'cancelada_paciente' | 'cancelada_medico' | 'no_asistio'

export async function actualizarEstadoCita(
  id: number,
  estado: EstadoCita,
): Promise<{ error: string | null }> {
  const { error } = await createClient().from('citas').update({ estado }).eq('id', id)
  if (error) return { error: error.message }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

export async function solicitarReagenda(
  id: number,
  motivo: string = 'Solicitud de médico: asignar fecha más próxima',
): Promise<{ error: string | null }> {
  const { error } = await createClient()
    .from('citas')
    .update({
      motivo_cancelacion: motivo,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

export async function reagendarCita(
  id: number,
  medicoId: number,
  duracionConsulta: number,
  fecha: string,
  hora: string,
): Promise<{ error: string | null }> {
  let rango: { inicio: string; fin: string }
  try {
    rango = rangoIso(fecha, hora, duracionConsulta)
  } catch {
    return { error: 'El horario seleccionado no es válido. Vuelve a elegirlo.' }
  }
  const { inicio, fin } = rango
  if (new Date(inicio).getTime() <= Date.now()) {
    return { error: 'No se puede reagendar una cita a un horario que ya transcurrió.' }
  }
  const { error } = await createClient()
    .from('citas')
    .update({
      inicio,
      fin,
      estado: 'confirmada',
      motivo_cancelacion: 'Reagendada por recepción: nuevo horario asignado',
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) {
    const mensaje = error.message.toLowerCase()
    if (mensaje.includes('citas_no_traslape') || mensaje.includes('exclusion')) {
      return { error: 'Ese horario ya está ocupado. Elige otro disponible.' }
    }
    return { error: error.message }
  }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

type PacienteFila = {
  id: number; esta_activo: boolean; fecha_nacimiento: string | null
  genero: string | null; notas_medicas: string | null
  usuarios: { nombre_completo: string; correo?: string | null; telefono: string | null } | { nombre_completo: string; correo?: string | null; telefono: string | null }[] | null
}

export async function cargarPacientes(): Promise<{ filas: Row[]; error: string | null }> {
  let filas: PacienteFila[]
  try {
    const respuesta = await fetch('/api/pacientes', { cache: 'no-store' })
    const resultado = await respuesta.json()
    if (!respuesta.ok) return { filas: [], error: resultado.error || 'No se pudo cargar el directorio.' }
    filas = resultado.pacientes
  } catch { return { filas: [], error: 'No se pudo conectar con el directorio de pacientes.' } }
  if (!filas.length) return { filas: [], error: null }
  const { data: citasData } = await createClient().from('citas')
    .select('paciente_id, inicio, motivo, perfiles_medicos(usuarios(nombre_completo))')
    .in('paciente_id', filas.map((p) => p.id)).in('estado', ['pendiente', 'confirmada', 'atendida'])
    .order('inicio', { ascending: false }).limit(200)

  type CitaResumenPaciente = {
    medico: string
    hora: string
    motivo: string
  }
  const citasPorPaciente = new Map<number, CitaResumenPaciente>()
  if (citasData) {
    for (const c of citasData as any[]) {
      if (c.paciente_id && !citasPorPaciente.has(c.paciente_id)) {
        const medRel = Array.isArray(c.perfiles_medicos) ? c.perfiles_medicos[0] : c.perfiles_medicos
        const usuRel = Array.isArray(medRel?.usuarios) ? medRel?.usuarios[0] : medRel?.usuarios
        const medicoNombre = usuRel?.nombre_completo || 'Por asignar'
        const horaFormateada = c.inicio ? horaDe(c.inicio) : '—'
        const motivoTexto = c.motivo || 'Consulta general'
        citasPorPaciente.set(c.paciente_id, {
          medico: medicoNombre,
          hora: horaFormateada,
          motivo: motivoTexto,
        })
      }
    }
  }

  return {
    error: null,
    filas: filas.map((paciente) => {
      const usuario = Array.isArray(paciente.usuarios) ? paciente.usuarios[0] : paciente.usuarios
      const infoCita = citasPorPaciente.get(paciente.id)
      const medicoAsignado = infoCita?.medico || 'Por asignar'
      const horaCita = infoCita?.hora || '—'
      const motivoCita = infoCita?.motivo || 'Consulta general'
      const generoTexto =
        paciente.genero === 'M' ? 'Masculino' : paciente.genero === 'F' ? 'Femenino' : paciente.genero || '—'
      return [
        usuario?.nombre_completo ?? '—',
        `PAC-${String(paciente.id).padStart(5, '0')}`,
        usuario?.telefono ?? '—',
        paciente.fecha_nacimiento ? fechaDe(paciente.fecha_nacimiento) : '—',
        generoTexto,
        paciente.esta_activo ? 'Activo' : 'Inactivo',
        String(paciente.id),
        paciente.notas_medicas ?? '',
        (usuario as { correo?: string } | null)?.correo ?? '',
        medicoAsignado,
        horaCita,
        motivoCita,
      ]
    }),
  }
}

type MedicoFila = {
  id: number; especialidad: string; esta_activo: boolean; duracion_consulta: number
  usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null
}

type ExpedienteFila = {
  id: number; cita_id: number; diagnostico: string | null; receta: string | null; notas_doctor: string | null; creado_en: string
  citas: {
    motivo: string | null
    perfiles_pacientes: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
    perfiles_medicos: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
  } | null
}

export type HistorialPaciente = {
  id?: number
  fechaIso?: string
  fecha: string
  motivo: string
  diagnostico: string
  receta: string
  notas: string
  medico: string
}

export type SignosVitales = {
  presionArterial?: string
  frecuenciaCardiaca?: string
  temperatura?: string
  saturacionOxigeno?: string
  peso?: string
  glucosa?: string
  tomadoPor?: string
  fechaHora?: string
}

export type FichaImportante = {
  alergias?: string
  tipoSangre?: string
  condicionesCronicas?: string
  signosVitales?: SignosVitales
  medicamentoActual?: string
}

export function parsearFichaImportante(raw: string | null | undefined): FichaImportante {
  if (!raw || !raw.trim()) return {}
  try {
    const obj = JSON.parse(raw)
    if (typeof obj === 'object' && obj !== null) return obj as FichaImportante
  } catch {
    return { condicionesCronicas: raw }
  }
  return {}
}

export async function guardarFichaImportante(
  pacienteId: number,
  ficha: FichaImportante,
  seccion: 'alertas' | 'signos' | 'completa' = 'completa',
): Promise<{ ok: boolean; error: string | null; ficha?: FichaImportante }> {
  try {
    const res = await fetch('/api/pacientes/ficha-importante', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pacienteId, ficha, seccion }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      return { ok: false, error: data.error || 'Error al guardar ficha importante' }
    }
    return { ok: true, error: null, ficha: data.ficha }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}

export type PerfilPacienteDetalle = {
  id: number
  nombre: string
  correo: string
  telefono: string
  fechaNacimiento: string
  genero: string
  estaActivo: boolean
  notasMedicas: string
}

export async function cargarPerfilPaciente(pacienteId: number): Promise<{ perfil: PerfilPacienteDetalle | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('perfiles_pacientes')
    .select('id, esta_activo, fecha_nacimiento, genero, notas_medicas, usuarios(nombre_completo, correo, telefono)')
    .eq('id', pacienteId)
    .maybeSingle()
  if (error) return { perfil: null, error: error.message }
  if (!data) return { perfil: null, error: null }
  const u = Array.isArray(data.usuarios) ? data.usuarios[0] : data.usuarios
  return {
    perfil: {
      id: data.id,
      nombre: u?.nombre_completo ?? '—',
      correo: (u as { correo?: string } | null)?.correo ?? '—',
      telefono: (u as { telefono?: string } | null)?.telefono ?? '—',
      fechaNacimiento: data.fecha_nacimiento ? fechaDe(data.fecha_nacimiento) : '—',
      genero: data.genero === 'M' ? 'Masculino' : data.genero === 'F' ? 'Femenino' : data.genero ?? '—',
      estaActivo: data.esta_activo,
      notasMedicas: data.notas_medicas ?? '',
    },
    error: null,
  }
}

export async function cargarHistorialPaciente(pacienteId: number): Promise<{ filas: HistorialPaciente[]; error: string | null }> {
  const supabase = createClient()
  const { filas: citas, error: errorCitas } = await consultar<{ id: number; motivo: string | null; perfiles_medicos: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null }[] | null }>(
    supabase.from('citas')
      .select('id, motivo, perfiles_medicos(usuarios(nombre_completo))')
      .eq('paciente_id', pacienteId)
  )
  if (errorCitas) return { filas: [], error: errorCitas }
  const ids = citas.map((cita) => cita.id)
  if (ids.length === 0) return { filas: [], error: null }
  const medicoDe = new Map<number, string>(
    citas.map((cita) => {
      const relacion = cita.perfiles_medicos
      const perfil = Array.isArray(relacion) ? (relacion[0] ?? null) : relacion
      const usuario = perfil?.usuarios
      const nombre = Array.isArray(usuario) ? (usuario[0]?.nombre_completo ?? '—') : (usuario?.nombre_completo ?? '—')
      return [cita.id, nombre]
    }),
  )
  const motivoDe = new Map<number, string>(citas.map((cita) => [cita.id, cita.motivo ?? 'Consulta general']))
  const { filas, error } = await consultar<{ id: number; cita_id: number; diagnostico: string | null; receta: string | null; notas_doctor: string | null; creado_en: string }>(
    supabase.from('expedientes')
      .select('id, cita_id, diagnostico, receta, notas_doctor, creado_en')
      .in('cita_id', ids)
      .order('creado_en', { ascending: false })
      .limit(20)
  )
  return {
    error,
    filas: filas.map((item) => ({
      id: item.id,
      fechaIso: item.creado_en,
      fecha: fechaDe(item.creado_en),
      motivo: motivoDe.get(item.cita_id) ?? 'Consulta general',
      diagnostico: item.diagnostico ?? 'Sin diagnóstico',
      receta: item.receta ?? 'Sin receta',
      notas: item.notas_doctor ?? '',
      medico: medicoDe.get(item.cita_id) ?? '—',
    })),
  }
}

export type DatosExpediente = {
  id?: number
  citaId: number
  diagnostico: string
  receta: string
  notas: string
}

export async function guardarExpediente(datos: DatosExpediente): Promise<{ error: string | null; id?: number }> {
  try {
    const res = await fetch('/api/expedientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    const json = await res.json()
    if (!res.ok || json.error) {
      return { error: json.error || 'Error al guardar el expediente' }
    }
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    return { error: null, id: json.data?.[0]?.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al guardar el expediente' }
  }
}

export async function eliminarExpediente(expedienteId: number): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/expedientes?id=${expedienteId}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (!res.ok || json.error) {
      return { error: json.error || 'Error al eliminar el expediente' }
    }
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al eliminar el expediente' }
  }
}

export async function cargarExpedientePorId(expedienteId: number): Promise<{
  expediente: { id: number; citaId: number; diagnostico: string; receta: string; notas: string; fecha: string; paciente: string; medico: string; motivo: string } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('expedientes')
    .select('id, cita_id, diagnostico, receta, notas_doctor, creado_en, citas(id, motivo, inicio, perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(usuarios(nombre_completo)))')
    .eq('id', expedienteId)
    .maybeSingle()

  if (error) return { expediente: null, error: error.message }
  if (!data) return { expediente: null, error: null }

  const cita = (data as any).citas
  const pac = Array.isArray(cita?.perfiles_pacientes) ? cita?.perfiles_pacientes[0] : cita?.perfiles_pacientes
  const usrPac = Array.isArray(pac?.usuarios) ? pac?.usuarios[0] : pac?.usuarios
  const med = Array.isArray(cita?.perfiles_medicos) ? cita?.perfiles_medicos[0] : cita?.perfiles_medicos
  const usrMed = Array.isArray(med?.usuarios) ? med?.usuarios[0] : med?.usuarios

  return {
    expediente: {
      id: data.id,
      citaId: data.cita_id,
      diagnostico: data.diagnostico ?? '',
      receta: data.receta ?? '',
      notas: data.notas_doctor ?? '',
      fecha: fechaDe(data.creado_en),
      paciente: usrPac?.nombre_completo ?? 'Paciente',
      medico: usrMed?.nombre_completo ?? 'Médico',
      motivo: cita?.motivo ?? 'Consulta general',
    },
    error: null,
  }
}

export async function cargarExpedienteCita(citaId: number): Promise<{
  expediente: { diagnostico: string; receta: string; notas: string } | null
  error: string | null
}> {
  const { data, error } = await createClient()
    .from('expedientes')
    .select('diagnostico, receta, notas_doctor')
    .eq('cita_id', citaId)
    .maybeSingle()
  if (error) return { expediente: null, error: error.message }
  if (!data) return { expediente: null, error: null }
  return {
    expediente: {
      diagnostico: data.diagnostico ?? '',
      receta: data.receta ?? '',
      notas: data.notas_doctor ?? '',
    },
    error: null,
  }
}

export async function cargarExpedientes(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<ExpedienteFila>(
    supabase.from('expedientes')
      .select('id, cita_id, diagnostico, receta, notas_doctor, creado_en, citas(motivo, perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(usuarios(nombre_completo)))')
      .order('creado_en', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((expediente) => {
      const cita = expediente.citas
      const pacRel = cita?.perfiles_pacientes
      const medRel = cita?.perfiles_medicos
      const usuarioMed = Array.isArray(medRel) ? medRel[0]?.usuarios : medRel?.usuarios
      const nombreMed = Array.isArray(usuarioMed) ? usuarioMed[0]?.nombre_completo : usuarioMed?.nombre_completo
      return [
        nombreDe(Array.isArray(pacRel) ? pacRel[0]?.usuarios : pacRel?.usuarios),
        cita?.motivo ?? 'Consulta general',
        expediente.diagnostico ?? 'Sin diagnóstico',
        nombreMed ?? 'Médico',
        fechaDe(expediente.creado_en),
        String(expediente.id),
        String(expediente.cita_id ?? ''),
        expediente.receta ?? '',
        expediente.notas_doctor ?? '',
      ]
    }),
  }
}

type InternacionFila = {
  id: number; cama_id?: number; habitacion_id?: number; fecha_ingreso: string; fecha_alta?: string | null; estado: string
  habitaciones: { numero: string } | { numero: string }[] | null
  camas: { numero: string; esta_ocupada: boolean } | { numero: string; esta_ocupada: boolean }[] | null
  perfiles_pacientes: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
  perfiles_medicos: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
}

export async function cargarInternacion(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<InternacionFila>(
    supabase.from('internaciones')
      .select('id, cama_id, habitacion_id, fecha_ingreso, fecha_alta, estado, habitaciones(numero), camas(numero, esta_ocupada), perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(usuarios(nombre_completo))')
      .order('fecha_ingreso', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((internacion) => {
      const habitacion = Array.isArray(internacion.habitaciones) ? internacion.habitaciones[0] : internacion.habitaciones
      const cama = Array.isArray(internacion.camas) ? internacion.camas[0] : internacion.camas
      const pac = Array.isArray(internacion.perfiles_pacientes) ? internacion.perfiles_pacientes[0] : internacion.perfiles_pacientes
      const med = Array.isArray(internacion.perfiles_medicos) ? internacion.perfiles_medicos[0] : internacion.perfiles_medicos
      const usuarioMed = Array.isArray(med?.usuarios) ? med?.usuarios[0] : med?.usuarios
      return [
        ubicacionHospital(habitacion?.numero ?? '—', cama?.numero ?? '—'),
        nombreDe(pac?.usuarios),
        fechaDe(internacion.fecha_ingreso),
        usuarioMed?.nombre_completo ?? 'Médico tratante',
        ETIQUETA_ESTADO_INTERNACION[internacion.estado] ?? internacion.estado,
        String(internacion.id),
        String(internacion.cama_id ?? ''),
        internacion.estado,
      ]
    }),
  }
}

type OrdenFila = {
  id: number; descripcion: string; tipo_orden: string; estado: string; fecha_prescripcion: string; episodio_id: number
  episodios_medicos: {
    tipo_episodio: string
    perfiles_medicos: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
    internaciones: {
      perfiles_pacientes: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
    } | null
  } | null
}

export async function cargarOrdenesMedicas(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<OrdenFila>(
    supabase.from('ordenes_medicas')
      .select('id, descripcion, tipo_orden, estado, fecha_prescripcion, episodio_id, episodios_medicos(tipo_episodio, perfiles_medicos(usuarios(nombre_completo)), internaciones(perfiles_pacientes(usuarios(nombre_completo))))')
      .order('fecha_prescripcion', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((orden) => {
      const ep = Array.isArray(orden.episodios_medicos) ? orden.episodios_medicos[0] : orden.episodios_medicos
      const med = Array.isArray(ep?.perfiles_medicos) ? ep?.perfiles_medicos[0] : ep?.perfiles_medicos
      const usuarioMed = Array.isArray(med?.usuarios) ? med?.usuarios[0] : med?.usuarios
      return [
        `ORD-${String(orden.id).padStart(4, '0')}`,
        ep?.tipo_episodio ? `Ep. ${ep.tipo_episodio}` : `Episodio #${orden.episodio_id}`,
        usuarioMed?.nombre_completo ?? 'Médico',
        orden.descripcion,
        ETIQUETA_ESTADO_ORDEN[orden.estado] ?? orden.estado,
        String(orden.id),
      ]
    }),
  }
}

type SolicitudFila = {
  id: number; estado_analisis: string; fecha_solicitud: string; resultado: string | null; observaciones: string | null
  archivo_resultado: string | null; fecha_resultado: string | null
  catalogo_analisis: { nombre: string } | { nombre: string }[] | null
  ordenes_medicas: {
    id: number
    episodios_medicos: {
      internaciones: {
        perfiles_pacientes: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
      } | null
    } | null
  } | null
}

export async function cargarLaboratorio(solicitudId?: number): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  let consulta = supabase.from('solicitudes_analisis')
    .select('id, estado_analisis, fecha_solicitud, resultado, observaciones, archivo_resultado, fecha_resultado, catalogo_analisis(nombre), ordenes_medicas(id, episodios_medicos(internaciones(perfiles_pacientes(usuarios(nombre_completo)))))')
  if (solicitudId !== undefined) consulta = consulta.eq('id', solicitudId)
  const { filas, error } = await consultar<SolicitudFila>(
    consulta
      .order('fecha_solicitud', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((solicitud) => {
      const analisis = Array.isArray(solicitud.catalogo_analisis) ? solicitud.catalogo_analisis[0] : solicitud.catalogo_analisis
      const ord = Array.isArray(solicitud.ordenes_medicas) ? solicitud.ordenes_medicas[0] : solicitud.ordenes_medicas
      return [
        `LAB-${String(solicitud.id).padStart(4, '0')}`,
        ord?.id ? `ORD-${String(ord.id).padStart(4, '0')}` : 'General',
        analisis?.nombre ?? 'Análisis clínico',
        fechaDe(solicitud.fecha_solicitud),
        solicitud.estado_analisis,
        String(solicitud.id),
        solicitud.resultado ?? '',
        solicitud.observaciones ?? '',
        solicitud.archivo_resultado ?? '',
        solicitud.fecha_resultado ?? '',
      ]
    }),
  }
}

export async function cargarModulo(nombre: string): Promise<{ filas: Row[]; error: string | null }> {
  if (nombre === 'Citas') return cargarCitas()
  if (nombre === 'Pacientes') return cargarPacientes()
  if (nombre === 'Médicos') return cargarMedicos()
  if (nombre === 'Expedientes') return cargarExpedientes()
  if (nombre === 'Internación') return cargarInternacion()
  if (nombre === 'Órdenes médicas') return cargarOrdenesMedicas()
  if (nombre === 'Laboratorio') return cargarLaboratorio()
  return { filas: [], error: null }
}

export type EstadisticasResumen = Record<string, { value: string; meta: string }>

export type MedicoTurno = { nombre: string; especialidad: string; estado: string }

export type ResumenCamas = { ocupadas: number; total: number; libres: number }

export async function cargarResumenEstadisticas(): Promise<{
  filas: EstadisticasResumen
  error: string | null
}> {
  const supabase = createClient()
  const inicioDelDia = new Date()
  inicioDelDia.setHours(0, 0, 0, 0)
  const finDelDia = new Date(inicioDelDia)
  finDelDia.setDate(inicioDelDia.getDate() + 1)

  const [citas, pacientes, camas, ordenes] = await Promise.all([
    supabase.from('citas').select('id', { count: 'exact', head: true })
      .gte('inicio', inicioDelDia.toISOString()).lt('inicio', finDelDia.toISOString()),
    supabase.from('perfiles_pacientes').select('id', { count: 'exact', head: true }).eq('esta_activo', true),
    supabase.from('camas').select('id', { count: 'exact', head: true }).eq('esta_ocupada', true),
    supabase.from('ordenes_medicas').select('id', { count: 'exact', head: true }).in('estado', ['prescrita', 'en_proceso']),
  ])

  return {
    error: citas.error?.message ?? pacientes.error?.message ?? camas.error?.message ?? ordenes.error?.message ?? null,
    filas: {
      'Citas de hoy': { value: String(citas.count ?? 0), meta: 'Datos en tiempo real' },
      'Pacientes activos': { value: (pacientes.count ?? 0).toLocaleString('es-MX'), meta: 'Pacientes activos' },
      'Camas ocupadas': { value: String(camas.count ?? 0), meta: 'Ocupación actual' },
      'Órdenes pendientes': { value: String(ordenes.count ?? 0), meta: 'Requieren atención' },
    },
  }
}

export async function cargarMedicosTurno(): Promise<{ filas: MedicoTurno[]; error: string | null }> {
  const { filas, error } = await consultar<{
    especialidad: string
    usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null
  }>(
    createClient().from('perfiles_medicos')
      .select('especialidad, usuarios!inner(nombre_completo)')
      .eq('esta_activo', true)
  )
  return {
    error,
    filas: filas.map((doctor) => {
      const usuario = Array.isArray(doctor.usuarios) ? doctor.usuarios[0] : doctor.usuarios
      return {
        nombre: usuario?.nombre_completo ?? 'Médico',
        especialidad: doctor.especialidad,
        estado: 'Disponible',
      }
    }),
  }
}

export async function cargarResumenCamas(): Promise<{ filas: ResumenCamas; error: string | null }> {
  const supabase = createClient()
  const [total, ocupadas] = await Promise.all([
    supabase.from('camas').select('id', { count: 'exact', head: true }),
    supabase.from('camas').select('id', { count: 'exact', head: true }).eq('esta_ocupada', true),
  ])
  const totalCamas = total.count ?? 0
  const ocupadasCamas = ocupadas.count ?? 0
  return {
    error: total.error?.message ?? ocupadas.error?.message ?? null,
    filas: {
      ocupadas: ocupadasCamas,
      total: totalCamas,
      libres: Math.max(totalCamas - ocupadasCamas, 0),
    },
  }
}

export type MedicoAgenda = {
  id: number
  nombre: string
  especialidad: string
  duracionConsulta: number
  clinicaId?: number
}

export type DiaDisponible = {
  fecha: string
  etiqueta: string
  slots: string[]
}

const NOMBRE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fechaLocal(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

function nombreDia(fecha: string): string {
  return NOMBRE_DIA[fechaLocal(fecha).getDay()]
}

export function formatearEtiquetaDia(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const d = new Date(anio, mes - 1, dia)
  const diaSem = NOMBRE_DIA[d.getDay()]
  const mesNom = MESES_CORTOS[mes - 1]

  const hoy = new Date()
  const fechaHoy = aIso(hoy)

  const maniana = new Date(hoy)
  maniana.setDate(hoy.getDate() + 1)
  const fechaManiana = aIso(maniana)

  if (fecha === fechaHoy) {
    return `Hoy (${dia} ${mesNom})`
  }
  if (fecha === fechaManiana) {
    return `Mañana (${dia} ${mesNom})`
  }
  return `${diaSem} ${dia} ${mesNom}`
}

export function filtrarDiasVigentes(dias: DiaDisponible[]): DiaDisponible[] {
  const ahora = new Date()
  const fechaHoy = aIso(ahora)

  return dias
    .map((dia) => {
      if (dia.fecha !== fechaHoy) return dia
      const slotsVigentes = dia.slots.filter((slot) => {
        const min = aMinutos(slot)
        if (Number.isNaN(min)) return false
        const h = Math.floor(min / 60)
        const m = min % 60
        const slotFecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), h, m)
        return slotFecha.getTime() > ahora.getTime()
      })
      return { ...dia, slots: slotsVigentes }
    })
    .filter((dia) => dia.slots.length > 0)
}

function aIso(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function formato12h(hora: string): string {
  const [h, m] = hora.split(':').map(Number)
  const periodo = h >= 12 ? 'PM' : 'AM'
  const hora12 = h % 12 === 0 ? 12 : h % 12
  return `${hora12}:${String(m).padStart(2, '0')} ${periodo}`
}

function aMinutos(hora: string): number {
  const coincide = hora.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  if (!coincide) return Number.NaN

  let horas = Number(coincide[1])
  const minutos = Number(coincide[2])
  const periodo = coincide[3]?.toLowerCase()
  if (periodo === 'pm' && horas !== 12) horas += 12
  if (periodo === 'am' && horas === 12) horas = 0

  if (minutos < 0 || minutos > 59 || horas < 0 || horas > 23) return Number.NaN

  return horas * 60 + minutos
}

function rangoIso(fecha: string, hora: string, duracionMin: number): { inicio: string; fin: string } {
  const minutos = aMinutos(hora)
  const [anio, mes, dia] = fecha.split('-').map(Number)

  const base = new Date(anio, mes - 1, dia, Math.floor(minutos / 60), minutos % 60)
  if (!Number.isFinite(anio) || !Number.isFinite(minutos) || Number.isNaN(base.getTime())) {
    throw new Error(`Fecha u hora no válida: "${fecha} ${hora}"`)
  }

  const fin = new Date(base.getTime() + duracionMin * 60_000)
  return { inicio: base.toISOString(), fin: fin.toISOString() }
}

export async function cargarMedicosAgenda(): Promise<{ filas: MedicoAgenda[]; error: string | null }> {
  const { filas, error } = await consultar<{
    id: number
    especialidad: string
    duracion_consulta: number
    clinica_id: number
    usuarios: { nombre_completo: string; esta_activo?: boolean } | { nombre_completo: string; esta_activo?: boolean }[] | null
  }>(
    createClient()
      .from('perfiles_medicos')
      .select('id, especialidad, duracion_consulta, clinica_id, usuarios(nombre_completo,esta_activo)')
      .eq('esta_activo', true)
      .order('id', { ascending: true })
      .limit(100)
  )

  return {
    error,
    filas: filas.filter((fila) => (Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios)?.esta_activo !== false).map((fila) => {
      const usuario = Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios
      return {
        id: fila.id,
        clinicaId: fila.clinica_id,
        nombre: usuario?.nombre_completo ?? 'Médico sin nombre',
        especialidad: fila.especialidad,
        duracionConsulta: fila.duracion_consulta || 20,
      }
    }),
  }
}

export async function cargarDisponibilidad(medicoId: number, _duracionConsulta: number, _diasVista = 7): Promise<{ filas: DiaDisponible[]; error: string | null }> {
  try {
    const agenda = await leerAgendaMedico(medicoId)
    return { filas: agenda.dias.filter((dia) => dia.slots.length).map((dia) => ({ fecha: dia.fecha, etiqueta: formatearEtiquetaDia(dia.fecha), slots: dia.slots.map((slot) => formato12h(new Date(slot.inicio).toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }))) })), error: agenda.configurado ? null : 'Este médico aún no tiene un horario publicado.' }
  } catch (error) { return { filas: [], error: error instanceof Error ? error.message : 'No se pudo consultar la disponibilidad.' } }
}

export async function cargarMedicos(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<MedicoFila>(
    supabase.from('perfiles_medicos')
      .select('id, especialidad, esta_activo, duracion_consulta, usuarios(nombre_completo)')
      .order('id', { ascending: true })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((medico) => {
      const usuario = Array.isArray(medico.usuarios) ? medico.usuarios[0] : medico.usuarios
      return [
        usuario?.nombre_completo ?? '—',
        medico.especialidad,
        `Cédula ${medico.id}`,
        `${medico.duracion_consulta} min por consulta`,
        medico.esta_activo ? 'Disponible' : 'Inactivo',
        String(medico.id),
      ]
    }),
  }
}

export type DatosNuevaCita = {
  pacienteId: number
  medicoId: number
  clinicaId: number
  fecha: string
  hora: string
  motivo: string
  duracionConsulta: number
}

export async function crearCita(datos: DatosNuevaCita): Promise<{ id: number | null; error: string | null }> {
  try {
    const minutos = aMinutos(datos.hora)
    if (!Number.isFinite(minutos)) return { id: null, error: 'Selecciona una hora válida.' }
    const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
    const respuesta = await fetch('/api/citas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pacienteId: datos.pacienteId, medicoId: datos.medicoId, fecha: datos.fecha, hora, motivo: datos.motivo }) })
    const resultado = await respuesta.json()
    if (!respuesta.ok) return { id: null, error: resultado.error || 'No se pudo agendar la cita.' }
    return { id: resultado.id, error: null }
  } catch { return { id: null, error: 'No se pudo conectar con el servicio de citas. Vuelve a intentarlo.' } }
}

export async function cargarPacientesParaCita(): Promise<{
  filas: { id: number; nombre: string }[]
  error: string | null
}> {
  const { filas, error } = await consultar<{
    id: number
    usuarios: { nombre_completo: string; esta_activo?: boolean } | { nombre_completo: string; esta_activo?: boolean }[] | null
  }>(
    createClient()
      .from('perfiles_pacientes')
      .select('id, usuarios(nombre_completo,esta_activo)')
      .eq('esta_activo', true)
      .order('id', { ascending: true })
      .limit(200)
  )
  if (error) return { filas: [], error }

  return {
    error: null,
    filas: filas.filter((fila) => (Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios)?.esta_activo !== false).map((fila) => {
      const usuario = Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios
      return { id: fila.id, nombre: usuario?.nombre_completo ?? 'Paciente sin nombre' }
    }),
  }
}

export async function cargarClinicaActiva(): Promise<number | null> {
  const { filas } = await consultar<{ id: number }>(
    createClient().from('clinicas').select('id').eq('esta_activo', true).order('id').limit(1)
  )
  return filas[0]?.id ?? null
}
export type CitaDetalle = {
  id: number
  pacienteId: number
  medicoId: number
  clinicaId: number
  inicio: string
  fin: string
  estado: EstadoCita
  motivo: string | null
  motivoCancelacion: string | null
  creado_en: string
  actualizado_en: string
  paciente: string
  medico: string
}

export type CitaActualizar = {
  pacienteId: number
  medicoId: number
  clinicaId: number
  fecha: string
  hora: string
  motivo: string
  duracionConsulta: number
}

export async function obtenerCita(
  id: number,
): Promise<{ cita: CitaDetalle | null; error: string | null }> {
  if (!id || Number.isNaN(id) || !Number.isFinite(id) || id <= 0) {
    return { cita: null, error: 'Identificador de cita no válido' }
  }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('citas')
    .select(
      `id, paciente_id, medico_id, clinica_id, inicio, fin, estado, motivo, motivo_cancelacion, creado_en, actualizado_en, perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(duracion_consulta, usuarios(nombre_completo))`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) return { cita: null, error: error.message }
  if (!data) return { cita: null, error: null }

  const pacienteRel = data.perfiles_pacientes as any
  const pacienteUsr = Array.isArray(pacienteRel) ? pacienteRel[0]?.usuarios : pacienteRel?.usuarios
  const medicoRel = data.perfiles_medicos as any
  const medicoUsr = Array.isArray(medicoRel) ? medicoRel[0]?.usuarios : medicoRel?.usuarios

  const cita = {
    id: data.id,
    pacienteId: data.paciente_id,
    medicoId: data.medico_id,
    clinicaId: data.clinica_id,
    inicio: data.inicio,
    fin: data.fin,
    estado: data.estado,
    motivo: data.motivo,
    motivoCancelacion: data.motivo_cancelacion,
    creado_en: data.creado_en,
    actualizado_en: data.actualizado_en,
    paciente: nombreDe(pacienteUsr),
    medico: nombreDe(medicoUsr),
  } as CitaDetalle

  return { cita, error: null }
}

export async function obtenerCitaPanel(
  id: number,
): Promise<{ cita: CitaPanel | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('citas')
    .select(
      `id, paciente_id, medico_id, clinica_id, inicio, fin, estado, motivo, motivo_cancelacion, perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(id, duracion_consulta, usuarios(nombre_completo))`,
    )
    .eq('id', id)
    .single()
  if (error) return { cita: null, error: error.message }
  if (!data) return { cita: null, error: null }

  const pacienteRel = data.perfiles_pacientes as any
  const pacienteUsr = Array.isArray(pacienteRel) ? pacienteRel[0]?.usuarios : pacienteRel?.usuarios
  const medicoRel = data.perfiles_medicos
  const medico: MedicoRelacion | null = Array.isArray(medicoRel) ? (medicoRel[0] ?? null) : (medicoRel as MedicoRelacion | null)
  const medicoUsr = Array.isArray(medico?.usuarios) ? medico?.usuarios[0] : medico?.usuarios

  const fechaObj = new Date(data.inicio)
  const cita: CitaPanel = {
    id: data.id,
    pacienteId: data.paciente_id,
    medicoId: medico?.id ?? data.medico_id,
    duracionConsulta: medico?.duracion_consulta ?? 20,
    fecha: fechaObj.toISOString().slice(0, 10),
    hora: horaDe(data.inicio),
    paciente: nombreDe(pacienteUsr),
    medico: nombreDe(medicoUsr),
    motivo: data.motivo ?? 'Sin motivo',
    motivoCancelacion: data.motivo_cancelacion,
    solicitaReagenda: Boolean(
      data.motivo_cancelacion &&
      data.motivo_cancelacion.toLowerCase().includes('reagenda') &&
      !data.motivo_cancelacion.toLowerCase().includes('por recepción')
    ),
    reagendadaPorRecepcion: Boolean(
      data.motivo_cancelacion &&
      data.motivo_cancelacion.toLowerCase().includes('reagendada por recepción')
    ),
    estado: ETIQUETA_ESTADO_CITA[data.estado] ?? data.estado,
    inicio: fechaObj.getTime(),
  }

  return { cita, error: null }
}

export async function actualizarCita(
  datos: CitaActualizar,
  id: number,
): Promise<{ error: string | null }> {
  let rango: { inicio: string; fin: string }
  try {
    rango = rangoIso(datos.fecha, datos.hora, datos.duracionConsulta)
  } catch {
    return { error: 'La fecha u hora seleccionadas no son válidas.' }
  }
  const { inicio, fin } = rango
  if (new Date(inicio).getTime() <= Date.now()) {
    return { error: 'No se puede reagendar una cita a un horario que ya transcurrió.' }
  }
  const supabase = createClient()
  const { error } = await supabase
    .from('citas')
    .update({
      paciente_id: datos.pacienteId,
      medico_id: datos.medicoId,
      clinica_id: datos.clinicaId,
      inicio,
      fin,
      motivo: datos.motivo.trim() || null,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) {
    const mensaje = error.message.toLowerCase()
    if (mensaje.includes('citas_no_traslape') || mensaje.includes('exclusion')) {
      return { error: 'Ese horario ya está ocupado por otra cita. Elige otro.' }
    }
    if (mensaje.includes('foreign key')) {
      return { error: 'No se pudo validar un dato de la cita. Revisa los valores.' }
    }
    return { error: error.message }
  }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

export async function eliminarCita(id: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from('citas').delete().eq('id', id)
  if (error) return { error: error.message }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

export async function cargarInsigniasMenu(): Promise<Record<string, string>> {
  const supabase = createClient()
  const [citasRes, internacionesRes, camasRes] = await Promise.all([
    supabase.from('citas').select('id', { count: 'exact', head: true }),
    supabase.from('internaciones').select('id', { count: 'exact', head: true }).eq('estado', 'activa'),
    supabase.from('camas').select('id', { count: 'exact', head: true }).eq('esta_ocupada', true),
  ])

  const totalCitas = citasRes.count ?? 0
  const totalInternaciones = (internacionesRes.count ?? 0) || (camasRes.count ?? 0)

  return {
    Citas: String(totalCitas),
    Internación: String(totalInternaciones),
  }
}

export async function derivarCitaMedico(
  citaId: number,
  nuevoMedicoId: number,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('citas')
    .update({
      medico_id: nuevoMedicoId,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', citaId)

  if (error) return { error: error.message }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

// ----------------------------------------------------
// Auxiliares de soporte para Internación, Órdenes y Lab
// ----------------------------------------------------

export type OpcionSelector = { id: number; nombre: string; detalle?: string }

export async function cargarOpcionesInternacion(): Promise<{
  pacientes: OpcionSelector[]
  medicos: OpcionSelector[]
  camasDisponibles: { id: number; habitacionId: number; numero: string; habitacion: string }[]
  error: string | null
}> {
  const supabase = createClient()
  const [pacientesRes, medicosRes, camasRes] = await Promise.all([
    supabase
      .from('perfiles_pacientes')
      .select('id, usuarios(nombre_completo)')
      .eq('esta_activo', true)
      .limit(100),
    supabase
      .from('perfiles_medicos')
      .select('id, especialidad, usuarios(nombre_completo)')
      .eq('esta_activo', true)
      .limit(100),
    supabase
      .from('camas')
      .select('id, numero, habitacion_id, habitaciones(id, numero, tipo)')
      .eq('esta_ocupada', false)
      .limit(50),
  ])

  const error = pacientesRes.error?.message ?? medicosRes.error?.message ?? camasRes.error?.message ?? null

  const pacientes: OpcionSelector[] = (pacientesRes.data ?? []).map((p: any) => {
    const usr = Array.isArray(p.usuarios) ? p.usuarios[0] : p.usuarios
    return { id: p.id, nombre: usr?.nombre_completo ?? 'Paciente' }
  })

  const medicos: OpcionSelector[] = (medicosRes.data ?? []).map((m: any) => {
    const usr = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios
    return { id: m.id, nombre: usr?.nombre_completo ?? 'Médico', detalle: m.especialidad }
  })

  const camasDisponibles = (camasRes.data ?? []).map((c: any) => {
    const hab = Array.isArray(c.habitaciones) ? c.habitaciones[0] : c.habitaciones
    return {
      id: c.id,
      habitacionId: c.habitacion_id,
      numero: c.numero,
      habitacion: hab?.numero ? `Hab. ${hab.numero} (${hab.tipo ?? 'General'})` : 'Habitación',
    }
  })

  return { pacientes, medicos, camasDisponibles, error }
}

export type DatosNuevaInternacion = {
  pacienteId: number
  medicoId: number
  camaId: number
  habitacionId: number
  motivoIngreso: string
  diagnosticoIngreso: string
}


export async function darAltaPaciente(internacionId: number, notaAlta?: string): Promise<{ error: string | null }> {
  try {
    if (!notaAlta?.trim()) return { error: 'Escribe una nota de egreso antes de confirmar el alta.' }
    const { ingreso } = await consultarHospital<{ ingreso: IngresoHospital }>(`/${internacionId}`)
    const res = await guardarHospital<{ advertencia?: string }>(`/${internacionId}`, { accion: 'alta', notaAlta, confirmado: true, version: ingreso.version }, 'PATCH')
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    return { error: res.advertencia ?? null }
  } catch (error) { return { error: error instanceof Error ? error.message : 'No se pudo registrar el alta.' } }
}

export async function crearInternacion(datos: DatosNuevaInternacion): Promise<{ error: string | null }> {
  try {
    await guardarHospital('', { pacienteId: datos.pacienteId, medicoId: datos.medicoId, camaId: datos.camaId, motivo: datos.motivoIngreso, diagnostico: datos.diagnosticoIngreso })
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    return { error: null }
  } catch (error) { return { error: error instanceof Error ? error.message : 'No se pudo registrar el ingreso.' } }
}

export async function darAltaInternacion(internacionId: number, notaAlta?: string): Promise<{ error: string | null }> {
  return darAltaPaciente(internacionId, notaAlta)
}

export async function cargarOpcionesOrdenes(): Promise<{
  internacionesActivas: { id: number; paciente: string; habitacionCama: string; medico: string; episodioId: number }[]
  catalogoAnalisis: { id: number; nombre: string; requiereAyuno: boolean }[]
  error: string | null
}> {
  const supabase = createClient()
  const [internacionesRes, catalogoRes] = await Promise.all([
    supabase
      .from('internaciones')
      .select('id, habitaciones(numero), camas(numero), perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(usuarios(nombre_completo)), episodios_medicos(id)')
      .eq('estado', 'activa')
      .order('fecha_ingreso', { ascending: false }),
    supabase
      .from('catalogo_analisis')
      .select('id, nombre, requiere_ayuno')
      .order('nombre', { ascending: true }),
  ])

  const error = internacionesRes.error?.message ?? catalogoRes.error?.message ?? null

  const internacionesActivas = (internacionesRes.data ?? []).map((item: any) => {
    const pac = Array.isArray(item.perfiles_pacientes) ? item.perfiles_pacientes[0] : item.perfiles_pacientes
    const usrPac = Array.isArray(pac?.usuarios) ? pac?.usuarios[0] : pac?.usuarios
    const med = Array.isArray(item.perfiles_medicos) ? item.perfiles_medicos[0] : item.perfiles_medicos
    const usrMed = Array.isArray(med?.usuarios) ? med?.usuarios[0] : med?.usuarios
    const hab = Array.isArray(item.habitaciones) ? item.habitaciones[0] : item.habitaciones
    const cama = Array.isArray(item.camas) ? item.camas[0] : item.camas
    const ep = Array.isArray(item.episodios_medicos) ? item.episodios_medicos[0] : item.episodios_medicos

    return {
      id: item.id,
      paciente: usrPac?.nombre_completo ?? 'Paciente',
      habitacionCama: `Hab. ${hab?.numero ?? '—'} · Cama ${cama?.numero ?? '—'}`,
      medico: usrMed?.nombre_completo ?? 'Médico',
      episodioId: ep?.id ?? 0,
    }
  })

  const catalogoAnalisis = (catalogoRes.data ?? []).map((cat: any) => ({
    id: cat.id,
    nombre: cat.nombre,
    requiereAyuno: Boolean(cat.requiere_ayuno),
  }))

  return { internacionesActivas, catalogoAnalisis, error }
}

export type DatosNuevaOrden = {
  internacionId: number
  episodioId?: number
  tipoOrden: 'analisis' | 'medicamento' | 'tratamiento' | 'procedimiento'
  descripcion: string
  instrucciones?: string
  analisisId?: number
}

export async function actualizarEstadoOrdenMedica(
  ordenId: number,
  nuevoEstado: 'prescrita' | 'en_proceso' | 'realizada' | 'cancelada',
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('ordenes_medicas')
    .update({ estado: nuevoEstado })
    .eq('id', ordenId)

  if (error) return { error: error.message }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

export async function crearOrdenMedica(datos: DatosNuevaOrden): Promise<{ error: string | null; id?: number }> {
  const supabase = createClient()
  let episodioId = datos.episodioId

  // Si no hay episodioId, buscar o crear uno para la internación
  if (!episodioId || episodioId === 0) {
    const { data: epExistente } = await supabase
      .from('episodios_medicos')
      .select('id')
      .eq('internacion_id', datos.internacionId)
      .limit(1)
      .maybeSingle()

    if (epExistente?.id) {
      episodioId = epExistente.id
    } else {
      const { data: epNuevo, error: errEp } = await supabase
        .from('episodios_medicos')
        .insert({
          internacion_id: datos.internacionId,
          tipo_episodio: 'Evolución',
          descripcion: 'Episodio generado para orden médica',
        })
        .select('id')
        .single()
      if (errEp || !epNuevo) return { error: errEp?.message || 'No se pudo crear el episodio clínico' }
      episodioId = epNuevo.id
    }
  }

  const { data: orden, error: errOrd } = await supabase
    .from('ordenes_medicas')
    .insert({
      episodio_id: episodioId,
      tipo_orden: datos.tipoOrden,
      descripcion: datos.descripcion,
      instrucciones: datos.instrucciones ?? null,
      estado: 'prescrita',
    })
    .select('id')
    .single()

  if (errOrd) return { error: errOrd.message }

  // Si la orden es de tipo análisis y se especificó un catálogo, crear la solicitud en laboratorio de inmediato
  if (datos.tipoOrden === 'analisis' && datos.analisisId && orden?.id) {
    const { error: errorSolicitud } = await supabase.from('solicitudes_analisis').insert({
      orden_medica_id: orden.id,
      analisis_id: datos.analisisId,
      estado_analisis: 'solicitado',
      observaciones: datos.instrucciones ?? null,
    })
    if (errorSolicitud) return { error: 'La orden se guardó, pero no se pudo generar la solicitud de laboratorio.', id: orden.id }
  }

  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null, id: orden?.id }
}

export async function guardarOrdenMedica(id: number, descripcion: string, instrucciones: string, estado: string): Promise<{ error: string | null }> {
  if (!['prescrita', 'en_proceso', 'realizada', 'cancelada'].includes(estado)) return { error: 'Estado de orden inválido.' }
  const { data, error } = await createClient().from('ordenes_medicas')
    .update({ descripcion: descripcion.trim(), instrucciones: instrucciones.trim() || null, estado, actualizado_en: new Date().toISOString() })
    .eq('id', id).select('id').maybeSingle()
  if (error || !data) return { error: error?.message || 'No tienes permiso para actualizar esta orden.' }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

export async function registrarResultadoLaboratorio(
  solicitudId: number,
  resultado: string,
  observaciones?: string,
  nuevoEstado: 'en proceso' | 'completado' = 'completado',
  archivo?: File,
  confirmarCompletado = false,
  version = '',
): Promise<{ error: string | null }> {
  try {
    const form = new FormData()
    form.set('resultado', resultado)
    form.set('observaciones', observaciones ?? '')
    form.set('estado', nuevoEstado)
    form.set('confirmarCompletado', String(confirmarCompletado))
    form.set('version', version)
    if (archivo) form.set('archivo', archivo)
    const res = await fetch(`/api/laboratorio/${solicitudId}`, { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'No se pudo guardar el resultado.' }
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
    return { error: null }
  } catch {
    return { error: 'No se pudo conectar para guardar el resultado. Inténtalo de nuevo.' }
  }
}

export async function marcarLaboratorioEnProceso(
  solicitudId: number,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('solicitudes_analisis')
    .update({
      estado_analisis: 'en proceso',
    })
    .eq('id', solicitudId)

  if (error) return { error: error.message }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

export async function cargarCitasParaExpediente(): Promise<{
  citas: { id: number; paciente: string; medico: string; fecha: string; motivo: string }[]
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('citas')
    .select('id, inicio, motivo, perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(usuarios(nombre_completo))')
    .order('inicio', { ascending: false })
    .limit(100)

  if (error) return { citas: [], error: error.message }

  const citas = (data ?? []).map((c: any) => {
    const pac = Array.isArray(c.perfiles_pacientes) ? c.perfiles_pacientes[0] : c.perfiles_pacientes
    const usrPac = Array.isArray(pac?.usuarios) ? pac?.usuarios[0] : pac?.usuarios
    const med = Array.isArray(c.perfiles_medicos) ? c.perfiles_medicos[0] : c.perfiles_medicos
    const usrMed = Array.isArray(med?.usuarios) ? med?.usuarios[0] : med?.usuarios

    return {
      id: c.id,
      paciente: usrPac?.nombre_completo ?? 'Paciente',
      medico: usrMed?.nombre_completo ?? 'Médico',
      fecha: fechaDe(c.inicio),
      motivo: c.motivo ?? 'Consulta médica',
    }
  })

  return { citas, error: null }
}

