'use client'

import { Download } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'
import type { Row } from '../../compartidos/types'
import { exportarCitasPDF, type CitaExportar } from '@/lib/exportar/exportar-citas-pdf'
import { exportarPacientesPDF, type PacienteExportar } from '@/lib/exportar/exportar-pacientes-pdf'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

export function BotonExportarModulo({
  modulo,
  filas = [],
  onAvisar,
  rol,
}: {
  modulo: string
  filas?: Row[]
  onAvisar: (mensaje: string) => void
  rol?: RolUsuario
  nombreUsuario?: string
}) {
  const esAdmin = rol === 'admin'

  // El botón de exportar es exclusivo únicamente para el Administrador
  if (!esAdmin) {
    return null
  }

  // Módulos con soporte de exportación
  if (modulo !== 'Pacientes' && modulo !== 'Citas') {
    return null
  }

  const handleExportar = () => {
    if (!esAdmin) {
      onAvisar('Acceso restringido: solo el administrador tiene permisos de exportación')
      return
    }

    if (modulo === 'Pacientes') {
      if (filas.length === 0) {
        onAvisar('No hay pacientes disponibles para exportar')
        return
      }

      const pacientesParaExportar: PacienteExportar[] = filas.map((row) => ({
        hora: row[10] || '—',
        nombre: row[0] ?? '',
        identificacion: row[1] ?? '',
        medico: row[9] || 'Por asignar',
        motivo: row[11] || 'Consulta general',
        telefono: row[2] ?? '',
        nacimiento: row[3] ?? '',
        estado: row[4] ?? '',
      }))

      onAvisar(`Generando directorio de pacientes en PDF (${pacientesParaExportar.length} pacientes)...`)
      exportarPacientesPDF(pacientesParaExportar, rol)
      return
    }

    if (modulo === 'Citas') {
      if (filas.length === 0) {
        onAvisar('No hay citas disponibles para exportar')
        return
      }

      const citasParaExportar: CitaExportar[] = filas.map((row) => ({
        hora: row[0] ?? '',
        paciente: row[1] ?? '',
        medico: row[2] ?? '',
        motivo: row[3] ?? '',
        estado: row[4] ?? '',
        inicio: row[6],
        fin: row[7],
      }))

      onAvisar(`Generando reporte general de citas (${citasParaExportar.length} citas)...`)
      exportarCitasPDF(citasParaExportar, {
        rol,
      })
      return
    }

    onAvisar(`Listado de ${modulo} exportado`)
  }

  const etiquetaBoton =
    modulo === 'Pacientes'
      ? 'Exportar directorio'
      : 'Exportar reporte'

  return (
    <ActionButton icon={Download} onClick={handleExportar}>
      {etiquetaBoton}
    </ActionButton>
  )
}
