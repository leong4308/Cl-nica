import { createClient } from '@/lib/supabase/client'
import { modules as mockModules, appointments as mockAppointments } from '@/components/modulos/compartidos/data'
import type { Row } from '@/components/modulos/compartidos/types'

export interface PacienteOption {
  id: number
  nombre: string
  identificacion: string
  telefono: string
  estado: string
}

export interface MedicoOption {
  id: number
  nombre: string
  especialidad: string
  clinica_id: number
}

// Obtener pacientes para buscadores y selects
export async function obtenerListaPacientes(): Promise<PacienteOption[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('perfiles_pacientes')
      .select('id, esta_activo, usuarios!inner(nombre_completo, telefono)')
      .order('id', { ascending: false })

    if (error || !data || data.length === 0) {
      return [
        { id: 1, nombre: 'Mariana Torres', identificacion: 'PAC-00124', telefono: '961-123-1235', estado: 'Activo' },
        { id: 2, nombre: 'Carlos Ramírez', identificacion: 'PAC-00119', telefono: '961-123-1236', estado: 'Activo' },
        { id: 3, nombre: 'Sofía Hernández', identificacion: 'PAC-00118', telefono: '961-123-1237', estado: 'Activo' },
        { id: 4, nombre: 'Roberto García', identificacion: 'PAC-00111', telefono: '961-123-1238', estado: 'Activo' },
      ]
    }

    return data.map((item) => {
      const u = Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios
      return {
        id: item.id,
        nombre: u?.nombre_completo ?? 'Paciente',
        identificacion: `PAC-${String(item.id).padStart(5, '0')}`,
        telefono: u?.telefono ?? 'Sin teléfono',
        estado: item.esta_activo ? 'Activo' : 'Inactivo',
      }
    })
  } catch {
    return [
      { id: 1, nombre: 'Mariana Torres', identificacion: 'PAC-00124', telefono: '961-123-1235', estado: 'Activo' },
      { id: 2, nombre: 'Carlos Ramírez', identificacion: 'PAC-00119', telefono: '961-123-1236', estado: 'Activo' },
    ]
  }
}

// Obtener médicos disponibles
export async function obtenerListaMedicos(): Promise<MedicoOption[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('perfiles_medicos')
      .select('id, especialidad, clinica_id, usuarios!inner(nombre_completo)')
      .eq('esta_activo', true)

    if (error || !data || data.length === 0) {
      return [
        { id: 1, nombre: 'Dra. Ana López', especialidad: 'Medicina general', clinica_id: 1 },
        { id: 2, nombre: 'Dr. Jorge Méndez', especialidad: 'Cardiología', clinica_id: 1 },
        { id: 3, nombre: 'Dra. Laura Ruiz', especialidad: 'Medicina interna', clinica_id: 1 },
      ]
    }

    return data.map((item) => {
      const u = Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios
      return {
        id: item.id,
        nombre: u?.nombre_completo ?? 'Médico',
        especialidad: item.especialidad,
        clinica_id: item.clinica_id ?? 1,
      }
    })
  } catch {
    return [
      { id: 1, nombre: 'Dra. Ana López', especialidad: 'Medicina general', clinica_id: 1 },
      { id: 2, nombre: 'Dr. Jorge Méndez', especialidad: 'Cardiología', clinica_id: 1 },
    ]
  }
}

// Obtener camas disponibles
export async function obtenerCamasDisponibles() {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('camas')
      .select('id, numero, esta_ocupada, habitacion_id, habitaciones(numero, clinica_id)')
    return data ?? []
  } catch {
    return []
  }
}

// Obtener registros para el listado de cada módulo
export async function obtenerDatosModulo(modulo: string): Promise<Row[]> {
  const supabase = createClient()

  try {
    switch (modulo) {
      case 'Citas': {
        const { data, error } = await supabase
          .from('citas')
          .select(`
            id,
            inicio,
            motivo,
            estado,
            perfiles_pacientes!inner(usuarios!inner(nombre_completo)),
            perfiles_medicos!inner(especialidad, usuarios!inner(nombre_completo))
          `)
          .order('inicio', { ascending: false })

        if (error || !data || data.length === 0) return mockModules.Citas.rows

        return data.map((item) => {
          const fecha = new Date(item.inicio)
          const hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
          const p = Array.isArray(item.perfiles_pacientes) ? item.perfiles_pacientes[0] : item.perfiles_pacientes
          const pu = Array.isArray(p?.usuarios) ? p.usuarios[0] : p?.usuarios
          const m = Array.isArray(item.perfiles_medicos) ? item.perfiles_medicos[0] : item.perfiles_medicos
          const mu = Array.isArray(m?.usuarios) ? m.usuarios[0] : m?.usuarios

          const estadoCapitalizado = item.estado ? item.estado.charAt(0).toUpperCase() + item.estado.slice(1) : 'Pendiente'
          return [
            hora,
            pu?.nombre_completo ?? 'Paciente',
            mu?.nombre_completo ?? 'Médico',
            item.motivo || m?.especialidad || 'Consulta',
            estadoCapitalizado,
          ]
        })
      }

      case 'Pacientes': {
        const { data, error } = await supabase
          .from('perfiles_pacientes')
          .select(`
            id,
            esta_activo,
            creado_en,
            usuarios!inner(nombre_completo, telefono)
          `)
          .order('id', { ascending: false })

        if (error || !data || data.length === 0) return mockModules.Pacientes.rows

        return data.map((item) => {
          const u = Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios
          const fecha = new Date(item.creado_en ?? Date.now()).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
          return [
            u?.nombre_completo ?? 'Paciente',
            `PAC-${String(item.id).padStart(5, '0')}`,
            u?.telefono ?? 'Sin teléfono',
            fecha,
            item.esta_activo ? 'Activo' : 'Inactivo',
          ]
        })
      }

      case 'Médicos': {
        const { data, error } = await supabase
          .from('perfiles_medicos')
          .select(`
            id,
            especialidad,
            duracion_consulta,
            esta_activo,
            usuarios!inner(nombre_completo)
          `)
          .order('id', { ascending: true })

        if (error || !data || data.length === 0) return mockModules['Médicos'].rows

        return data.map((item, index) => {
          const u = Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios
          return [
            u?.nombre_completo ?? 'Médico',
            item.especialidad,
            `Consultorio ${String(index + 1).padStart(2, '0')}`,
            '08:00 — 15:00',
            item.esta_activo ? 'Disponible' : 'Inactivo',
          ]
        })
      }

      case 'Expedientes': {
        const { data, error } = await supabase
          .from('expedientes')
          .select(`
            id,
            diagnostico,
            receta,
            creado_en,
            citas!inner(
              motivo,
              perfiles_pacientes!inner(usuarios!inner(nombre_completo)),
              perfiles_medicos!inner(usuarios!inner(nombre_completo))
            )
          `)
          .order('id', { ascending: false })

        if (error || !data || data.length === 0) return mockModules.Expedientes.rows

        return data.map((item) => {
          const cita = Array.isArray(item.citas) ? item.citas[0] : item.citas
          const p = Array.isArray(cita?.perfiles_pacientes) ? cita.perfiles_pacientes[0] : cita?.perfiles_pacientes
          const pu = Array.isArray(p?.usuarios) ? p.usuarios[0] : p?.usuarios
          const m = Array.isArray(cita?.perfiles_medicos) ? cita.perfiles_medicos[0] : cita?.perfiles_medicos
          const mu = Array.isArray(m?.usuarios) ? m.usuarios[0] : m?.usuarios

          const fecha = new Date(item.creado_en ?? Date.now()).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
          return [
            pu?.nombre_completo ?? 'Paciente',
            cita?.motivo ?? 'Consulta general',
            item.diagnostico || 'Sin diagnóstico',
            mu?.nombre_completo ?? 'Médico tratante',
            fecha,
          ]
        })
      }

      case 'Internación': {
        const { data, error } = await supabase
          .from('camas')
          .select(`
            id,
            numero,
            esta_ocupada,
            habitaciones!inner(numero)
          `)
          .order('id', { ascending: true })

        if (error || !data || data.length === 0) return mockModules.Internación.rows

        return data.map((item) => {
          const hab = Array.isArray(item.habitaciones) ? item.habitaciones[0] : item.habitaciones
          return [
            `${hab?.numero ?? 'Habitación'} - ${item.numero}`,
            item.esta_ocupada ? 'Paciente internado' : '—',
            item.esta_ocupada ? 'En estancia' : '—',
            item.esta_ocupada ? 'Dr. de Guardia' : '—',
            item.esta_ocupada ? 'Ocupada' : 'Disponible',
          ]
        })
      }

      case 'Órdenes médicas': {
        const { data, error } = await supabase
          .from('ordenes_medicas')
          .select(`
            id,
            tipo_orden,
            descripcion,
            estado,
            paciente_id,
            perfiles_pacientes(usuarios(nombre_completo)),
            perfiles_medicos(usuarios(nombre_completo))
          `)
          .order('id', { ascending: false })

        if (error || !data || data.length === 0) return mockModules['Órdenes médicas'].rows

        return data.map((item) => {
          const p = Array.isArray(item.perfiles_pacientes) ? item.perfiles_pacientes[0] : item.perfiles_pacientes
          const pu = Array.isArray(p?.usuarios) ? p.usuarios[0] : p?.usuarios
          const m = Array.isArray(item.perfiles_medicos) ? item.perfiles_medicos[0] : item.perfiles_medicos
          const mu = Array.isArray(m?.usuarios) ? m.usuarios[0] : m?.usuarios

          const tipo = item.tipo_orden ? item.tipo_orden.charAt(0).toUpperCase() + item.tipo_orden.slice(1) : 'Estudio'
          const est = item.estado ? item.estado.charAt(0).toUpperCase() + item.estado.slice(1).replace('_', ' ') : 'Pendiente'
          return [
            `ORD-${String(item.id).padStart(4, '0')}`,
            pu?.nombre_completo ?? 'Paciente',
            mu?.nombre_completo ?? 'Médico',
            `${tipo}: ${item.descripcion}`,
            est,
          ]
        })
      }

      case 'Laboratorio': {
        const { data, error } = await supabase
          .from('solicitudes_analisis')
          .select(`
            id,
            fecha_solicitud,
            estado_analisis,
            catalogo_analisis!inner(nombre),
            perfiles_pacientes(usuarios(nombre_completo))
          `)
          .order('id', { ascending: false })

        if (error || !data || data.length === 0) return mockModules.Laboratorio.rows

        return data.map((item) => {
          const est = item.catalogo_analisis
          const c = Array.isArray(est) ? est[0] : est
          const p = Array.isArray(item.perfiles_pacientes) ? item.perfiles_pacientes[0] : item.perfiles_pacientes
          const pu = Array.isArray(p?.usuarios) ? p.usuarios[0] : p?.usuarios
          const fecha = new Date(item.fecha_solicitud ?? Date.now()).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })

          const estadoMap: Record<string, string> = {
            solicitado: 'Pendiente',
            en_proceso: 'En proceso',
            completado: 'Listo',
          }

          return [
            `LAB-${String(item.id).padStart(4, '0')}`,
            pu?.nombre_completo ?? 'Paciente',
            c?.nombre ?? 'Análisis clínico',
            fecha,
            estadoMap[item.estado_analisis] ?? item.estado_analisis ?? 'Pendiente',
          ]
        })
      }

      default:
        return mockModules[modulo]?.rows ?? []
    }
  } catch (err) {
    console.error('Error al obtener datos del módulo:', modulo, err)
    return mockModules[modulo]?.rows ?? []
  }
}
