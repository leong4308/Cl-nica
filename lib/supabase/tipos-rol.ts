export type RolUsuario = 'admin' | 'medico' | 'recepcionista' | 'paciente' | 'enfermero'

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  admin: 'Administrador',
  medico: 'Médico',
  recepcionista: 'Recepcionista',
  paciente: 'Paciente',
  enfermero: 'Enfermero',
}
