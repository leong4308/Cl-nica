import { createClient } from './client'
import type { Row } from '@/components/modulos/compartidos/types'

type Resultado<T> = { filas: T[]; error: string | null }

/** Envuelve una consulta de Supabase y normaliza su resultado. */
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

/** Hora local en formato 24h "HH:MM". Se usa es-GB a propósito: es-MX devuelve
 *  "09:00 a. m." y los consumidores (estadoCalculado) no pueden parsearlo. */
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fechaDe = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

const ETIQUETA_ESTADO_CITA: Record<string, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', atendida: 'Atendida',
  cancelada_paciente: 'Cancelada por paciente', cancelada_medico: 'Cancelada por médico', no_asistio: 'No asistió',
}
const ETIQUETA_ESTADO_ORDEN: Record<string, string> = {
  prescrita: 'Pendiente', en_proceso: 'En proceso', realizada: 'Completada', cancelada: 'Cancelada',
}
const ETIQUETA_ESTADO_INTERNACION: Record<string, string> = { activa: 'Ocupada', alta: 'Alta', traslado: 'Traslado' }

type CitaFila = {
  id: number; inicio: string; estado: string; motivo: string | null
  perfiles_pacientes: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
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
      .select('id, inicio, estado, motivo, perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(usuarios(nombre_completo))')
      // De la más reciente a la más antigua. Esta consulta no filtra por día
      // (a diferencia del panel de check-in), así que el tope de 100 filas
      // siempre recortaba el FINAL de la lista: ordenando de más viejo a más
      // nuevo, bastaban 100 citas históricas para que una cita recién guardada
      // quedara fuera de la tabla. Con este orden lo que se recorta es el pasado
      // y lo nuevo siempre se ve.
      .order('inicio', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((cita) => {
      const medicoRel = cita.perfiles_medicos
      const medico: MedicoRelacion | null = Array.isArray(medicoRel) ? (medicoRel[0] ?? null) : medicoRel
      return [
        horaDe(cita.inicio),
        nombreDe(cita.perfiles_pacientes?.usuarios),
        nombreDe(medico?.usuarios),
        cita.motivo ?? 'Sin motivo',
        ETIQUETA_ESTADO_CITA[cita.estado] ?? cita.estado,
      ]
    }),
  }
}

export type CitaPanel = {
  /** Identificador de la cita, necesario para actualizarla en Supabase. */
  id: number
  /** Id de `perfiles_medicos`, para consultar la agenda al reagendar. */
  medicoId: number
  /** Duración de la consulta en minutos (viene del perfil médico). */
  duracionConsulta: number
  /** Fecha local "AAAA-MM-DD" de la cita. */
  fecha: string
  /** Hora local "HH:MM" de la cita. */
  hora: string
  paciente: string
  medico: string
  motivo: string
  /** Estado que viene de la base de datos, ya etiquetado. */
  estado: string
  /** Marca de tiempo real de la cita, para comparar con el reloj sin ambigüedad. */
  inicio: number
}

/**
 * Citas para el panel "Próximas citas", incluyendo la marca de tiempo real.
 * `cargarCitas` solo devuelve textos para la tabla; aquí hace falta el instante
 * exacto para saber si la cita ya pasó, sigue en curso o va con retraso.
 */
/** Instante en ISO del inicio del día local. Sirve para acotar consultas por día
 *  sin depender de la zona horaria del servidor, que puede ser otra. */
function inicioDiaLocal(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString()
}

/** Días que abarca el panel de check-in: el de hoy y los siguientes.
 *
 * Antes la consulta se ceñía al día en curso. Como la agenda de los médicos
 * solo corre de lunes a viernes, el panel salía siempre vacío el fin de
 * semana aunque se acabaran de agendar citas para el lunes, y el personal
 * veía "no hay citas registradas" sin saber que sí las había. */
const DIAS_VENTANA_PANEL = 7

export async function cargarCitasPanel(): Promise<{ filas: CitaPanel[]; error: string | null }> {
  const supabase = createClient()
  const hoy = new Date()
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + DIAS_VENTANA_PANEL)
  const { filas, error } = await consultar<CitaFila>(
    supabase.from('citas')
      .select('id, inicio, estado, motivo, perfiles_pacientes(usuarios(nombre_completo)), perfiles_medicos(id, duracion_consulta, usuarios(nombre_completo))')
      .order('inicio', { ascending: true })
      // Hoy y los días siguientes, nunca el pasado: el panel es de lo que
      // viene. Al acotar por ventana el orden ascendente se mantiene, así que
      // el tope de 100 filas solo recortaría el final y una cita recién
      // agendada para mañana siempre queda dentro.
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
      return {
        id: cita.id,
        medicoId: medico?.id ?? 0,
        duracionConsulta: medico?.duracion_consulta ?? 20,
        fecha: aIso(fechaLocal(new Date(cita.inicio).toLocaleDateString('en-CA'))),
        hora: horaDe(cita.inicio),
        paciente: nombreDe(cita.perfiles_pacientes?.usuarios),
        medico: nombreMedico ?? '—',
        motivo: cita.motivo ?? 'Sin motivo',
        estado: ETIQUETA_ESTADO_CITA[cita.estado] ?? cita.estado,
        inicio: new Date(cita.inicio).getTime(),
      }
    }),
  }
}

/** Estados válidos de `citas.estado` (enum public.estado_cita). */
export type EstadoCita = 'pendiente' | 'confirmada' | 'atendida' | 'cancelada_paciente' | 'cancelada_medico' | 'no_asistio'

/** Cambia el estado de una cita y devuelve un mensaje para la interfaz. */
export async function actualizarEstadoCita(
  id: number,
  estado: EstadoCita,
): Promise<{ error: string | null }> {
  const { error } = await createClient().from('citas').update({ estado }).eq('id', id)
  if (error) return { error: error.message }
  window.dispatchEvent(new CustomEvent('datos-actualizados'))
  return { error: null }
}

/** Mueve una cita a otra fecha/hora respetando la agenda libre del médico. */
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
  const { error } = await createClient()
    .from('citas')
    .update({ inicio, fin, estado: 'confirmada' })
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
  usuarios: { nombre_completo: string; telefono: string | null } | { nombre_completo: string; telefono: string | null }[] | null
}

export async function cargarPacientes(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<PacienteFila>(
    supabase.from('perfiles_pacientes')
      .select('id, esta_activo, fecha_nacimiento, usuarios(nombre_completo, telefono)')
      .order('id', { ascending: true })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((paciente) => {
      const usuario = Array.isArray(paciente.usuarios) ? paciente.usuarios[0] : paciente.usuarios
      return [
        usuario?.nombre_completo ?? '—',
        `PAC-${String(paciente.id).padStart(5, '0')}`,
        usuario?.telefono ?? '—',
        paciente.fecha_nacimiento ? fechaDe(paciente.fecha_nacimiento) : '—',
        paciente.esta_activo ? 'Activo' : 'Inactivo',
      ]
    }),
  }
}

type MedicoFila = {
  id: number; especialidad: string; esta_activo: boolean; duracion_consulta: number
  usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null
}


type ExpedienteFila = {
  id: number; diagnostico: string | null; creado_en: string
  citas: { motivo: string | null; perfiles_pacientes: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null } | null
}

export async function cargarExpedientes(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<ExpedienteFila>(
    supabase.from('expedientes')
      .select('id, diagnostico, creado_en, citas(motivo, perfiles_pacientes(usuarios(nombre_completo)))')
      .order('creado_en', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((expediente) => [
      nombreDe(expediente.citas?.perfiles_pacientes?.usuarios),
      expediente.citas?.motivo ?? 'Consulta general',
      expediente.diagnostico ?? 'Sin diagnóstico',
      '—',
      fechaDe(expediente.creado_en),
    ]),
  }
}

type InternacionFila = {
  id: number; fecha_ingreso: string; estado: string
  habitaciones: { numero: string } | { numero: string }[] | null
  camas: { numero: string; esta_ocupada: boolean } | { numero: string; esta_ocupada: boolean }[] | null
  perfiles_pacientes: { usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null } | null
}

export async function cargarInternacion(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<InternacionFila>(
    supabase.from('internaciones')
      // El recurso incrustado se llama `habitaciones`: con doble "b" PostgREST
      // responde 400 (PGRST200) y el módulo de Internación se queda sin datos.
      .select('id, fecha_ingreso, estado, habitaciones(numero), camas(numero, esta_ocupada), perfiles_pacientes(usuarios(nombre_completo))')
      .order('fecha_ingreso', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((internacion) => {
      const habitacion = Array.isArray(internacion.habitaciones) ? internacion.habitaciones[0] : internacion.habitaciones
      const cama = Array.isArray(internacion.camas) ? internacion.camas[0] : internacion.camas
      return [
        `${habitacion?.numero ?? '—'} · Cama ${cama?.numero ?? '—'}`,
        nombreDe(internacion.perfiles_pacientes?.usuarios),
        fechaDe(internacion.fecha_ingreso),
        '—',
        ETIQUETA_ESTADO_INTERNACION[internacion.estado] ?? internacion.estado,
      ]
    }),
  }
}

type OrdenFila = {
  id: number; descripcion: string; tipo_orden: string; estado: string; fecha_prescripcion: string
}

export async function cargarOrdenesMedicas(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<OrdenFila>(
    supabase.from('ordenes_medicas')
      .select('id, descripcion, tipo_orden, estado, fecha_prescripcion')
      .order('fecha_prescripcion', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((orden) => [
      `ORD-${String(orden.id).padStart(4, '0')}`,
      '—',
      '—',
      orden.descripcion,
      ETIQUETA_ESTADO_ORDEN[orden.estado] ?? orden.estado,
    ]),
  }
}

type SolicitudFila = {
  id: number; estado_analisis: string; fecha_solicitud: string; resultado: string | null
  catalogo_analisis: { nombre: string } | { nombre: string }[] | null
}

export async function cargarLaboratorio(): Promise<{ filas: Row[]; error: string | null }> {
  const supabase = createClient()
  const { filas, error } = await consultar<SolicitudFila>(
    supabase.from('solicitudes_analisis')
      .select('id, estado_analisis, fecha_solicitud, resultado, catalogo_analisis(nombre)')
      .order('fecha_solicitud', { ascending: false })
      .limit(100)
  )
  return {
    error,
    filas: filas.map((solicitud) => {
      const analisis = Array.isArray(solicitud.catalogo_analisis) ? solicitud.catalogo_analisis[0] : solicitud.catalogo_analisis
      return [
        `LAB-${String(solicitud.id).padStart(4, '0')}`,
        '—',
        analisis?.nombre ?? '—',
        fechaDe(solicitud.fecha_solicitud),
        solicitud.estado_analisis,
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

/** Valores de los cuatro indicadores de la pantalla de inicio, por etiqueta. */
export type EstadisticasResumen = Record<string, { value: string; meta: string }>

/** Fila de "Médicos en turno" en el panel lateral. */
export type MedicoTurno = { nombre: string; especialidad: string; estado: string }

/** Ocupación de camas del panel lateral. */
export type ResumenCamas = { ocupadas: number; total: number; libres: number }

/**
 * Conteos del resumen. Vive aquí (y no en el componente) para poder precargarlos
 * junto con el resto de datos y que el panel se pinte sin esperas.
 */
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
    supabase.from('camas').select('id', { count: 'exact', head: true }),
    supabase.from('ordenes_medicas').select('id', { count: 'exact', head: true }).in('estado', ['prescrita', 'en_proceso']),
  ])

  return {
    error: citas.error?.message ?? pacientes.error?.message ?? camas.error?.message ?? ordenes.error?.message ?? null,
    filas: {
      'Citas de hoy': { value: String(citas.count ?? 0), meta: 'Datos en tiempo real' },
      'Pacientes activos': { value: (pacientes.count ?? 0).toLocaleString('es-MX'), meta: 'Pacientes activos' },
      'Camas ocupadas': { value: String(camas.count ?? 0), meta: 'Ocupación actual' },
      'Órdenes pendientes': { value: String(ordenes.count ?? 0).padStart(2, '0'), meta: 'Requieren atención' },
    },
  }
}

/** Médicos activos para el panel lateral "Médicos en turno". */
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

/** Ocupación de camas para el panel lateral "Camas e internación". */
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
}

export type DiaDisponible = {
  fecha: string
  /** Nombre del día en español, p. ej. "Lunes". */
  etiqueta: string
  slots: string[]
}

const NOMBRE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** "2026-10-05" -> Date local (evita el corrimiento de zona horaria de `new Date(iso)`). */
function fechaLocal(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/**
 * Nombre del día de una fecha "AAAA-MM-DD", siempre el día real del calendario.
 *
 * Las tarjetas del selector muestran SOLO este nombre: antes ponían "Hoy" o
 * "Mañana" y debajo la fecha corta ("05 oct"), lo que ocupaba dos líneas y
 * mezclaba dos ideas en la misma tarjeta. Ahora la etiqueta es el día tal cual
 * aparece en el calendario.
 *
 * No hay desfase: el rótulo va en el mismo orden que `Date.getDay()`, que es la
 * convención de `agenda_medicos.dia_semana` con la que se calcula la
 * disponibilidad. Desplazar el rótulo solo haría que un día se anunciara con
 * el nombre de otro sin cambiar los horarios que realmente se ofrecen.
 */
function nombreDia(fecha: string): string {
  return NOMBRE_DIA[fechaLocal(fecha).getDay()]
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

/** Minutos desde medianoche, para comparar horas de Supabase.
 *  Acepta los dos formatos que conviven en la app: el de la base de datos
 *  ("14:30") y el que ve y elige el usuario en la interfaz ("2:30 PM"). Antes
 *  solo entendía el primero, así que al guardar una cita el cálculo daba NaN y
 *  `toISOString()` reventaba con "Invalid time value". */
function aMinutos(hora: string): number {
  const coincide = hora.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  if (!coincide) return Number.NaN

  let horas = Number(coincide[1])
  const minutos = Number(coincide[2])
  const periodo = coincide[3]?.toLowerCase()
  if (periodo === 'pm' && horas !== 12) horas += 12
  if (periodo === 'am' && horas === 12) horas = 0

  // La expresión regular acepta "25:00" y "09:75" porque solo mira la forma.
  // Sin este rango, `new Date(y, m, d, 25, 0)` no revienta: normaliza al día
  // siguiente y la cita se guardaría en la fecha equivocada sin avisar.
  if (minutos < 0 || minutos > 59 || horas < 0 || horas > 23) return Number.NaN

  return horas * 60 + minutos
}

/** Rango [inicio, fin) en UTC (ISO-8601 con Z) para guardar en timestamptz.
 *  Importante: se convierte con toISOString() para que Postgres no interprete
 *  la hora como UTC. Sin el offset, una cita de 9:00 se guardaría 6 horas antes.
 *  Si la fecha o la hora no tienen sentido lanza un error legible, en vez de
 *  dejar que `toISOString()` reviente con un RangeError incomprensible. */
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

/** Lista los médicos activos de la clínica con su especialidad. */
export async function cargarMedicosAgenda(): Promise<{ filas: MedicoAgenda[]; error: string | null }> {
  const { filas, error } = await consultar<{
    id: number
    especialidad: string
    duracion_consulta: number
    usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null
  }>(
    createClient()
      .from('perfiles_medicos')
      .select('id, especialidad, duracion_consulta, usuarios(nombre_completo)')
      .eq('esta_activo', true)
      .order('id', { ascending: true })
      .limit(100)
  )

  return {
    error,
    filas: filas.map((fila) => {
      const usuario = Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios
      return {
        id: fila.id,
        nombre: usuario?.nombre_completo ?? 'Médico sin nombre',
        especialidad: fila.especialidad,
        duracionConsulta: fila.duracion_consulta || 20,
      }
    }),
  }
}

/**
 * Calcula los próximos días con agenda libre para un médico.
 * Cruza `agenda_medicos` (horarios del médico) con `citas` (lo ya ocupado)
 * y descarta los horarios que se traslapan con una cita existente.
 *
 * `diasVista` son 7 a propósito: exactamente una semana completa. Antes iba
 * en 10 y el modal mostraba diez tarjetas seguidas, así que la semana se
 * cortaba a mitad (lunes, martes, miércoles… y vuelta a empezar) y nunca se
 * veía el ciclo lunes→domingo cerrado. Con 7 días consecutivos siempre se ve
 * la semana entera, sin repetir ni recortar.
 */
export async function cargarDisponibilidad(
  medicoId: number,
  duracionConsulta: number,
  diasVista = 7,
): Promise<{ filas: DiaDisponible[]; error: string | null }> {
  const supabase = createClient()

  const agenda = await consultar<{
    dia_semana: number
    hora_inicio: string
    hora_fin: string
    duracion_slot: number
  }>(
    supabase
      .from('agenda_medicos')
      .select('dia_semana, hora_inicio, hora_fin, duracion_slot')
      .eq('medico_id', medicoId)
      .eq('esta_activo', true)
      .order('hora_inicio', { ascending: true })
  )
  if (agenda.error) return { filas: [], error: agenda.error }

  if (agenda.filas.length === 0) {
    return { filas: [], error: 'Este médico todavía no tiene un horario de atención configurado.' }
  }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const ventana: string[] = []
  for (let i = 0; i < diasVista; i += 1) {
    const dia = new Date(hoy)
    dia.setDate(hoy.getDate() + i)
    ventana.push(aIso(dia))
  }

  // Citas vigentes del médico dentro de la ventana, para saber qué está ocupado.
  const desde = `${ventana[0]}T00:00:00`
  const hasta = `${ventana[ventana.length - 1]}T23:59:59`
  const ocupadas = await consultar<{ inicio: string; fin: string }>(
    supabase
      .from('citas')
      .select('inicio, fin')
      .eq('medico_id', medicoId)
      .in('estado', ['pendiente', 'confirmada'])
      .gte('inicio', desde)
      .lte('inicio', hasta)
  )

  const rangoOcupado = ocupadas.filas.map((cita) => ({
    inicio: new Date(cita.inicio).getTime(),
    fin: new Date(cita.fin).getTime(),
  }))

  const filas: DiaDisponible[] = []
  for (const fecha of ventana) {
    const diaSemana = fechaLocal(fecha).getDay()
    const bloques = agenda.filas.filter((b) => b.dia_semana === diaSemana)
    if (bloques.length === 0) continue

    const slots: string[] = []
    for (const bloque of bloques) {
      const paso = bloque.duracion_slot || duracionConsulta || 20
      const inicioMin = aMinutos(bloque.hora_inicio.slice(0, 5))
      const finMin = aMinutos(bloque.hora_fin.slice(0, 5))
      for (let minuto = inicioMin; minuto + paso <= finMin; minuto += paso) {
        const hora = `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`
        const { inicio, fin } = rangoIso(fecha, hora, duracionConsulta || 20)
        const t0 = new Date(inicio).getTime()
        const t1 = new Date(fin).getTime()
        const choca = rangoOcupado.some((ocupado) => t0 < ocupado.fin && t1 > ocupado.inicio)
        if (!choca) slots.push(formato12h(hora))
      }
    }

    // El día actual solo ofrece horas que todavía no pasaron.
    const filtrados = fecha === aIso(hoy)
      ? slots.filter((slot) => {
        const [texto, periodo] = slot.split(' ')
        const [h, m] = texto.split(':').map(Number)
        let horas = h % 12
        if (periodo === 'PM' && h !== 12) horas += 12
        return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), horas, m) > new Date()
      })
      : slots

    if (filtrados.length === 0) continue

    // La tarjeta muestra únicamente el nombre del día ("Lunes", "Miércoles"...).
    filas.push({ fecha, etiqueta: nombreDia(fecha), slots: filtrados })
  }

  return { filas, error: null }
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

/** Crea una cita en Supabase. La base de datos rechaza los traslapes. */
export async function crearCita(datos: DatosNuevaCita): Promise<{ id: number | null; error: string | null }> {
  let rango: { inicio: string; fin: string }
  try {
    rango = rangoIso(datos.fecha, datos.hora, datos.duracionConsulta)
  } catch {
    return { id: null, error: 'El horario seleccionado no es válido. Vuelve a elegirlo.' }
  }
  const { inicio, fin } = rango
  const supabase = createClient()

  const { data, error } = await supabase
    .from('citas')
    .insert({
      paciente_id: datos.pacienteId,
      medico_id: datos.medicoId,
      clinica_id: datos.clinicaId,
      inicio,
      fin,
      estado: 'pendiente',
      motivo: datos.motivo.trim() || 'Consulta general',
    })
    .select('id')
    .single()

  if (error) {
    const mensaje = error.message.toLowerCase()
    if (mensaje.includes('citas_no_traslape') || mensaje.includes('exclusion')) {
      return { id: null, error: 'Ese horario acaba de ocuparse. Elige otro disponible.' }
    }
    if (mensaje.includes('foreign key')) {
      return { id: null, error: 'No se pudo validar el paciente o la clínica. Revisa los datos.' }
    }
    return { id: null, error: error.message }
  }

  return { id: data?.id ?? null, error: null }
}

/** Lista los pacientes activos para poder asignarlos a una cita. */
export async function cargarPacientesParaCita(): Promise<{
  filas: { id: number; nombre: string }[]
  error: string | null
}> {
  const { filas, error } = await consultar<{
    id: number
    usuarios: { nombre_completo: string } | { nombre_completo: string }[] | null
  }>(
    createClient()
      .from('perfiles_pacientes')
      .select('id, usuarios(nombre_completo)')
      .eq('esta_activo', true)
      .order('id', { ascending: true })
      .limit(200)
  )
  if (error) return { filas: [], error }

  return {
    error: null,
    filas: filas.map((fila) => {
      const usuario = Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios
      return { id: fila.id, nombre: usuario?.nombre_completo ?? 'Paciente sin nombre' }
    }),
  }
}

/** Devuelve la clínica activa (`citas.clinica_id` es obligatorio). */
export async function cargarClinicaActiva(): Promise<number | null> {
  const { filas } = await consultar<{ id: number }>(
    createClient().from('clinicas').select('id').eq('esta_activo', true).order('id').limit(1)
  )
  return filas[0]?.id ?? null
}
