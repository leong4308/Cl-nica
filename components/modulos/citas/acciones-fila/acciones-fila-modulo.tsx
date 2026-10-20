'use client'

import { RowActions } from '../../compartidos/ui'
import type { CitaPanel } from '@/lib/supabase/datos'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'
import { precargarDetalleCita, registrarCitaRapida } from '@/lib/supabase/cache-detalle-cita'

import {
  leerPerfilPacienteEnCache,
  precargarPerfilPaciente,
  registrarPerfilPacienteEnCache,
} from '@/lib/supabase/cache-pacientes'

type PropsAccionesFilaModulo = {
  id: string
  fila?: string[]
  modulo?: string
  esMedico?: boolean
  rol?: RolUsuario
  onAbrirModal: (titulo: string) => void
  onAccion?: (cita: CitaPanel, accion: 'detalle' | 'reagendar' | 'historial') => void
}

export function AccionesFilaModulo({
  id,
  fila,
  modulo,
  esMedico,
  rol,
  onAbrirModal,
}: PropsAccionesFilaModulo) {
  if (rol === 'recepcionista') {
    return null
  }

  if (modulo === 'Citas' && (esMedico || rol === 'medico')) {
    return null
  }

  if (modulo === 'Pacientes') {
    const numId = Number(id)

    const handleVerPaciente = () => {
      if (fila && !Number.isNaN(numId)) {
        const existente = leerPerfilPacienteEnCache(numId)
        registrarPerfilPacienteEnCache({
          id: numId,
          nombre: fila[0] || existente?.nombre || 'Paciente',
          correo: fila[8] || existente?.correo || '',
          telefono: fila[2] || existente?.telefono || '—',
          fechaNacimiento: fila[3] || existente?.fechaNacimiento || '—',
          genero: fila[4] || existente?.genero || '—',
          estaActivo: fila[5] ? fila[5] === 'Activo' : (existente?.estaActivo ?? true),
          notasMedicas: fila[7] || existente?.notasMedicas || '',
        })
      }
      onAbrirModal(`PacienteDetalle: ${id}`)
    }

    const esAdmin = rol === 'admin'
    return (
      <RowActions
        onView={handleVerPaciente}
        onHoverView={!Number.isNaN(numId) ? () => void precargarPerfilPaciente(numId) : undefined}
        onEdit={esAdmin ? () => onAbrirModal(`Editar: ${id}`) : undefined}
        onDelete={esAdmin ? () => onAbrirModal(`Eliminar: ${id}`) : undefined}
      />
    )
  }

  const pacienteId = fila?.[8] ? Number(fila[8]) : undefined
  const esAdmin = rol === 'admin'

  return (
    <RowActions
      onView={() => {
        if (modulo === 'Citas' && pacienteId && !Number.isNaN(pacienteId)) {
          const existente = leerPerfilPacienteEnCache(pacienteId)
          registrarPerfilPacienteEnCache({
            id: pacienteId,
            nombre: fila?.[1] || existente?.nombre || 'Paciente',
            correo: fila?.[14] || existente?.correo || '',
            telefono: fila?.[12] || existente?.telefono || '—',
            fechaNacimiento: fila?.[11] || existente?.fechaNacimiento || '—',
            genero: fila?.[10] === 'M' ? 'Masculino' : fila?.[10] === 'F' ? 'Femenino' : fila?.[10] || existente?.genero || '—',
            estaActivo: fila?.[13] ? fila?.[13] === 'Activo' : (existente?.estaActivo ?? true),
            notasMedicas: existente?.notasMedicas || '',
          })
          onAbrirModal(`PacienteDetalle: ${pacienteId}`)
          return
        }
        onAbrirModal(`Detalle: ${id}`)
      }}
      onHoverView={modulo === 'Citas' && pacienteId && !Number.isNaN(pacienteId) ? () => void precargarPerfilPaciente(pacienteId) : undefined}
      onEdit={esAdmin ? () => onAbrirModal(`Editar: ${id}`) : undefined}
      onDelete={esAdmin ? () => onAbrirModal(`Eliminar: ${id}`) : undefined}
    />
  )
}
