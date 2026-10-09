import { createClient } from '@/lib/supabase/client'

// Crear una nueva cita en Supabase
export async function crearCita(datos: {
  paciente_id: number
  medico_id: number
  clinica_id?: number
  inicio: string // ISO string
  fin: string    // ISO string
  motivo: string
}) {
  const supabase = createClient()
  const clinica_id = datos.clinica_id ?? 1

  const { data, error } = await supabase
    .from('citas')
    .insert([
      {
        paciente_id: datos.paciente_id,
        medico_id: datos.medico_id,
        clinica_id,
        inicio: datos.inicio,
        fin: datos.fin,
        motivo: datos.motivo || 'Consulta médica',
        estado: 'pendiente',
      },
    ])
    .select()

  if (error) {
    console.error('Error al insertar cita en Supabase:', error)
    throw new Error(error.message)
  }

  // Notificar al sistema para refresco en tiempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cita-actualizada'))
  }

  return data
}

// Actualizar estado de una cita (confirmar, cancelar, atender)
export async function cambiarEstadoCita(cita_id: number, nuevoEstado: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('citas')
    .update({ estado: nuevoEstado })
    .eq('id', cita_id)
    .select()

  if (error) {
    console.error('Error al actualizar estado de la cita:', error)
    throw new Error(error.message)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cita-actualizada'))
  }

  return data
}

// Crear un nuevo paciente (inserta en usuarios y en perfiles_pacientes)
export async function crearPaciente(datos: {
  nombre_completo: string
  telefono?: string
  correo?: string
  fecha_nacimiento?: string
  genero?: string
  notas_medicas?: string
}) {
  const supabase = createClient()
  const emailLimpio = datos.correo?.trim() || `paciente_${Date.now()}@clinicanova.com`

  // 1. Insertar usuario base
  const { data: usuario, error: errUsuario } = await supabase
    .from('usuarios')
    .insert([
      {
        nombre_completo: datos.nombre_completo.trim(),
        telefono: datos.telefono?.trim() || null,
        correo: emailLimpio,
        rol: 'paciente',
        esta_activo: true,
      },
    ])
    .select()
    .single()

  if (errUsuario) {
    console.error('Error al crear usuario para paciente:', errUsuario)
    throw new Error(errUsuario.message)
  }

  // 2. Insertar perfil paciente
  const { data: perfil, error: errPerfil } = await supabase
    .from('perfiles_pacientes')
    .insert([
      {
        usuario_id: usuario.id,
        fecha_nacimiento: datos.fecha_nacimiento || null,
        genero: datos.genero || 'O',
        notas_medicas: datos.notas_medicas || null,
        esta_activo: true,
      },
    ])
    .select()
    .single()

  if (errPerfil) {
    console.error('Error al crear perfil paciente:', errPerfil)
    throw new Error(errPerfil.message)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('datos-actualizados', { detail: 'Pacientes' }))
  }

  return { usuario, perfil }
}

// Registrar un nuevo médico
export async function crearMedico(datos: {
  nombre_completo: string
  especialidad: string
  cedula_profesional: string
  telefono?: string
  correo?: string
  clinica_id?: number
}) {
  const supabase = createClient()
  const emailLimpio = datos.correo?.trim() || `medico_${Date.now()}@clinicanova.com`
  const clinica_id = datos.clinica_id ?? 1

  // 1. Crear usuario base
  const { data: usuario, error: errUsuario } = await supabase
    .from('usuarios')
    .insert([
      {
        nombre_completo: datos.nombre_completo.trim(),
        correo: emailLimpio,
        telefono: datos.telefono?.trim() || null,
        rol: 'medico',
        esta_activo: true,
      },
    ])
    .select()
    .single()

  if (errUsuario) {
    console.error('Error al crear usuario médico:', errUsuario)
    throw new Error(errUsuario.message)
  }

  // 2. Crear perfil médico
  const { data: perfil, error: errPerfil } = await supabase
    .from('perfiles_medicos')
    .insert([
      {
        usuario_id: usuario.id,
        clinica_id,
        especialidad: datos.especialidad.trim(),
        cedula_profesional: datos.cedula_profesional.trim(),
        duracion_consulta: 30,
        esta_activo: true,
      },
    ])
    .select()
    .single()

  if (errPerfil) {
    console.error('Error al crear perfil médico:', errPerfil)
    throw new Error(errPerfil.message)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('datos-actualizados', { detail: 'Médicos' }))
  }

  return { usuario, perfil }
}

// Crear un nuevo expediente médico
export async function crearExpediente(datos: {
  cita_id: number
  diagnostico: string
  receta?: string
  notas_doctor?: string
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('expedientes')
    .insert([
      {
        cita_id: datos.cita_id,
        diagnostico: datos.diagnostico,
        receta: datos.receta || null,
        notas_doctor: datos.notas_doctor || null,
      },
    ])
    .select()

  if (error) {
    console.error('Error al crear expediente:', error)
    throw new Error(error.message)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('datos-actualizados', { detail: 'Expedientes' }))
  }

  return data
}

// Crear una orden médica
export async function crearOrdenMedica(datos: {
  paciente_id?: number
  medico_id?: number
  tipo_orden: 'analisis' | 'medicamento' | 'tratamiento' | 'procedimiento'
  descripcion: string
  instrucciones?: string
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ordenes_medicas')
    .insert([
      {
        paciente_id: datos.paciente_id || 1,
        medico_id: datos.medico_id || 1,
        tipo_orden: datos.tipo_orden,
        descripcion: datos.descripcion,
        instrucciones: datos.instrucciones || null,
        estado: 'prescrita',
      },
    ])
    .select()

  if (error) {
    console.error('Error al crear orden médica:', error)
    throw new Error(error.message)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('datos-actualizados', { detail: 'Órdenes médicas' }))
  }

  return data
}
