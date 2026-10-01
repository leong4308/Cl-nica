export type UserRole = 'admin' | 'medico' | 'recepcionista' | 'paciente' | 'enfermero'

export interface AppUser {
  id: number
  auth_user_id: string
  correo: string
  nombre_completo: string
  telefono: string | null
  rol: UserRole
  esta_activo: boolean
}
