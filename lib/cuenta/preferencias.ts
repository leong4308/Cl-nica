import type { RolUsuario } from '@/lib/supabase/tipos-rol'

export type PreferenciasUsuario = { textoGrande: boolean; reducirAnimaciones: boolean; altoContraste: boolean; paginaInicio: string }
export const PREFERENCIAS_INICIALES: PreferenciasUsuario = { textoGrande: false, reducirAnimaciones: false, altoContraste: false, paginaInicio: 'Predeterminada' }
export function opcionesInicio(rol: RolUsuario): string[] {
  const comunes = ['Predeterminada', 'Citas', 'Pacientes']
  if (rol !== 'paciente' && rol !== 'medico') comunes.push('Resumen')
  if (['admin', 'medico', 'recepcionista'].includes(rol)) comunes.push('Expedientes')
  if (['admin', 'medico', 'enfermero'].includes(rol)) comunes.push('Órdenes médicas', 'Laboratorio')
  if (['admin', 'medico', 'enfermero'].includes(rol)) comunes.push('Internación')
  if (rol === 'medico') comunes.push('Mi Consulta')
  return rol === 'paciente' ? ['Predeterminada'] : comunes
}
export function normalizarPreferencias(valor: unknown, rol: RolUsuario): PreferenciasUsuario {
  const datos = valor && typeof valor === 'object' ? valor as Record<string, unknown> : {}
  return {
    textoGrande: datos.textoGrande === true,
    reducirAnimaciones: datos.reducirAnimaciones === true,
    altoContraste: datos.altoContraste === true,
    paginaInicio: typeof datos.paginaInicio === 'string' && opcionesInicio(rol).includes(datos.paginaInicio) ? datos.paginaInicio : 'Predeterminada',
  }
}
export function aplicarPreferencias(preferencias: PreferenciasUsuario) {
  document.documentElement.dataset.textoGrande = String(preferencias.textoGrande)
  document.documentElement.dataset.reducirAnimaciones = String(preferencias.reducirAnimaciones)
  document.documentElement.dataset.altoContraste = String(preferencias.altoContraste)
}
