export type SignosVitales = {
  presionArterial: string
  presionComparativa?: string
  presionAlerta?: boolean
  frecuenciaCardiaca: number
  frecuenciaRitmo?: string
  spo2: number
  temperatura: number
  temperaturaEstado?: string
  peso: number
  imc: number
  imcClasificacion?: string
}

export type ConsultaPrevia = {
  id: string
  fecha: string
  especialidad: string
  medico: string
  resumen: string
}

export type MedicamentoRecurrente = {
  id: string
  nombre: string
  dosis: string
  frecuencia: string
  via: string
  activo: boolean
}

export type ArchivoEstudio = {
  id: string
  nombre: string
  tipo: 'docx' | 'xlsx' | 'pdf' | 'dicom' | 'img'
  origen: string
  tamano: string
  fecha: string
}

export type DiagnosticoCie10 = {
  codigo: string
  descripcion: string
  tipo: 'Principal' | 'Secundario'
}

export type MedicamentoPrescrito = {
  id: string
  nombre: string
  tipo: 'Nuevo' | 'Continuación'
  posologia: string
  presentacion: string
}

export type CitaAgendaMedico = {
  id: number
  hora: string
  estado: 'confirmada' | 'en_espera' | 'atendida' | 'pendiente' | 'cancelada'
  tipoTurno: 'Recurrente' | 'Primera Consulta' | 'Revisión' | 'Control'
  pacienteId: number
  pacienteNombre: string
  expedienteFolio: string
  edad: number
  grupoSanguineo: string
  motivo: string
  alertas?: string[]
  signosVitales?: SignosVitales
  consultasPrevias?: ConsultaPrevia[]
  medicamentosActivos?: MedicamentoRecurrente[]
  archivosEstudios?: ArchivoEstudio[]
  soap?: {
    subjetivo: string
    objetivo: string
    diagnosticos: DiagnosticoCie10[]
    plan: string
  }
  prescripciones?: MedicamentoPrescrito[]
}

export type MedicoPerfil = {
  id: number
  nombre: string
  especialidad: string
  cedula: string
  clinica: string
  consultorio: string
  avatarUrl?: string
}
