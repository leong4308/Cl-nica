import {
  cargarHistorialPaciente,
  cargarExpedienteCita,
  obtenerCita,
  type CitaDetalle,
  type HistorialPaciente,
} from './datos'

export type CitaDetalleRapido = {
  id: number
  paciente: string
  medico: string
  estado: string
  inicio: string
  fin: string
  motivo?: string
  pacienteId?: number
}

type EntradasCache = {
  cita: CitaDetalle | null
  error: string | null
  expediente: { diagnostico: string; receta: string; notas: string } | null
  historial: HistorialPaciente[] | null
  historialError: string | null
}

const cacheCitas = new Map<number, EntradasCache>()
const cacheRapido = new Map<number, CitaDetalleRapido>()
const cacheHistoriales = new Map<number, HistorialPaciente[]>()
const enCurso = new Map<number, Promise<void>>()

/** Registra datos instantáneos de la cita obtenidos directamente de la fila de la tabla */
export function registrarCitaRapida(datos: CitaDetalleRapido): void {
  cacheRapido.set(datos.id, datos)
  // Pre-cargar historial de paciente silenciosamente en background si hay pacienteId
  if (datos.pacienteId && !cacheHistoriales.has(datos.pacienteId)) {
    void cargarHistorialPaciente(datos.pacienteId).then((res) => {
      if (!res.error && res.filas) {
        cacheHistoriales.set(datos.pacienteId!, res.filas)
      }
    })
  }
}

/** Lee los datos rápidos si existen */
export function leerCitaRapida(citaId: number): CitaDetalleRapido | null {
  return cacheRapido.get(citaId) ?? null
}

/** Lee el historial del paciente si ya está en caché */
export function leerHistorialPacienteEnCache(pacienteId: number): HistorialPaciente[] | null {
  return cacheHistoriales.get(pacienteId) ?? null
}

export function guardarHistorialPacienteEnCache(pacienteId: number, filas: HistorialPaciente[]): void {
  cacheHistoriales.set(pacienteId, filas)
}

/** Construye una CitaDetalle a partir de datos rápidos para render instantáneo */
export function rapidoACita(r: CitaDetalleRapido): CitaDetalle {
  return {
    id: r.id,
    pacienteId: r.pacienteId ?? 0,
    medicoId: 0,
    clinicaId: 1,
    inicio: r.inicio,
    fin: r.fin,
    estado: r.estado as any,
    motivo: r.motivo ?? 'Consulta médica general',
    motivoCancelacion: null,
    creado_en: '',
    actualizado_en: '',
    paciente: r.paciente,
    medico: r.medico,
  }
}

/** Retorna de inmediato la mejor información disponible (síncrona, 0ms) */
export function obtenerDatosCitaInicial(citaId: number): {
  cita: CitaDetalle | null
  expediente: EntradasCache['expediente']
  historial: HistorialPaciente[] | null
  error: string | null
} {
  const cached = cacheCitas.get(citaId)
  if (cached?.cita) {
    return {
      cita: cached.cita,
      expediente: cached.expediente,
      historial: cached.historial,
      error: cached.error,
    }
  }

  const rapido = cacheRapido.get(citaId)
  if (rapido) {
    const hist = rapido.pacienteId ? cacheHistoriales.get(rapido.pacienteId) ?? null : null
    return {
      cita: rapidoACita(rapido),
      expediente: null,
      historial: hist,
      error: null,
    }
  }

  return { cita: null, expediente: null, historial: null, error: null }
}

/** Lee del cache completo si existe */
export function leerDetalleCita(citaId: number): EntradasCache | null {
  return cacheCitas.get(citaId) ?? null
}

/** Pre-carga detalle + historial de una cita. Idempotente: no vuelve a cargar si ya está. */
export function precargarDetalleCita(citaId: number): Promise<void> {
  if (cacheCitas.has(citaId)) return Promise.resolve()
  if (enCurso.has(citaId)) return enCurso.get(citaId)!

  const trabajo = (async () => {
    const { cita, error } = await obtenerCita(citaId)
    let expediente: EntradasCache['expediente'] = null
    let historial: HistorialPaciente[] | null = null
    let historialError: string | null = null

    if (cita) {
      // Si tenemos datos, también registramos en rápido
      registrarCitaRapida({
        id: cita.id,
        paciente: cita.paciente,
        medico: cita.medico,
        estado: cita.estado,
        inicio: cita.inicio,
        fin: cita.fin,
        motivo: cita.motivo ?? undefined,
        pacienteId: cita.pacienteId,
      })

      const [expRes, histRes] = await Promise.all([
        cargarExpedienteCita(citaId),
        cargarHistorialPaciente(cita.pacienteId),
      ])
      if (expRes.expediente) {
        expediente = {
          diagnostico: expRes.expediente.diagnostico,
          receta: expRes.expediente.receta,
          notas: expRes.expediente.notas,
        }
      }
      historial = histRes.filas
      historialError = histRes.error
      if (historial) {
        cacheHistoriales.set(cita.pacienteId, historial)
      }
    }

    cacheCitas.set(citaId, { cita, error, expediente, historial, historialError })
  })().catch(() => undefined).finally(() => {
    enCurso.delete(citaId)
  })

  enCurso.set(citaId, trabajo)
  return trabajo
}

/** Invalida el cache de una cita (tras guardar o editar) */
export function invalidarDetalleCita(citaId: number): void {
  cacheCitas.delete(citaId)
}
