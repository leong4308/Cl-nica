'use client'

import type { ClinicActions } from '../compartidos/types'
import type { PerfilSesion } from '@/lib/supabase/sesion'
import { MedicosWorkstation } from './medicos-workstation'

// Entrada separada de la agenda de Médicos para integrar la pantalla de consulta sin alterar el agendado.
export function ConsultaAdministrativa(props: ClinicActions & { usuario: PerfilSesion }) {
  if (props.usuario.rol !== 'admin') {
    return <p role="alert" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Mi Consulta está disponible únicamente para administración.</p>
  }
  return <MedicosWorkstation {...props} modoConsulta />
}
