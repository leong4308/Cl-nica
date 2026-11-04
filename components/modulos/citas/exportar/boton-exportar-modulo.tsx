'use client'

import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'
import type { Row } from '../../compartidos/types'
import { exportarCitasPDF, type CitaExportar } from '@/lib/exportar/exportar-citas-pdf'
import { exportarPacientesPDF, type PacienteExportar } from '@/lib/exportar/exportar-pacientes-pdf'
import { exportarExpedientesExcel, exportarExpedientesPDF, type ExpedienteExportar } from '@/lib/exportar/exportar-expedientes'
import { exportarInternacionExcel, exportarInternacionPDF, type InternacionExportar } from '@/lib/exportar/exportar-internacion'
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
  const esMedico = rol === 'medico'
  const esEnfermero = rol === 'enfermero'

  // Modulos con soporte de exportacion
  if (modulo !== 'Pacientes' && modulo !== 'Citas' && modulo !== 'Expedientes' && modulo !== 'Internación') {
    return null
  }

  // Permisos segun rol
  if (!esAdmin && !(modulo === 'Expedientes' && esMedico) && !(modulo === 'Internación' && (esMedico || esEnfermero))) {
    return null
  }

  if (modulo === 'Internación') {
    const internaciones: InternacionExportar[] = filas.map((row) => ({
      ubicacion: row[0] ?? '',
      paciente: row[1] ?? '',
      ingreso: row[2] ?? '',
      medico: row[3] ?? '',
      estado: row[4] ?? '',
    }))

    return (
      <div className="flex items-center gap-2">
        <ActionButton
          icon={FileText}
          onClick={() => {
            if (filas.length === 0) {
              onAvisar('No hay registros de internación para exportar')
              return
            }
            onAvisar('Generando censo de camas en PDF...')
            exportarInternacionPDF(internaciones)
          }}
        >
          Censo PDF
        </ActionButton>
        <ActionButton
          icon={FileSpreadsheet}
          onClick={() => {
            if (filas.length === 0) {
              onAvisar('No hay registros de internación para exportar')
              return
            }
            onAvisar('Descargando censo en Excel...')
            exportarInternacionExcel(internaciones)
          }}
        >
          Censo Excel
        </ActionButton>
      </div>
    )
  }

  if (modulo === 'Expedientes') {
    const expedientes: ExpedienteExportar[] = filas.map((row) => ({
      paciente: row[0] ?? '',
      motivo: row[1] ?? '',
      diagnostico: row[2] ?? '',
      medico: row[3] ?? '',
      actualizado: row[4] ?? '',
    }))

    return (
      <div className="flex items-center gap-2">
        <ActionButton
          icon={FileText}
          onClick={() => {
            if (filas.length === 0) {
              onAvisar('No hay expedientes para exportar')
              return
            }
            onAvisar('Generando informe PDF de expedientes...')
            exportarExpedientesPDF(expedientes)
          }}
        >
          Informe PDF
        </ActionButton>
        <ActionButton
          icon={FileSpreadsheet}
          onClick={() => {
            if (filas.length === 0) {
              onAvisar('No hay expedientes para exportar')
              return
            }
            onAvisar('Descargando expedientes en Excel (CSV)...')
            exportarExpedientesExcel(expedientes)
          }}
        >
          Descargar Excel
        </ActionButton>
      </div>
    )
  }

  const handleExportar = () => {
    if (!esAdmin) {
      onAvisar('Acceso restringido: solo el administrador tiene permisos de exportacion')
      return
    }

    if (modulo === 'Pacientes') {
      if (filas.length === 0) {
        onAvisar('No hay pacientes disponibles para exportar')
        return
      }

      const pacientesParaExportar: PacienteExportar[] = filas.map((row) => ({
        hora: row[10] || '-',
        nombre: row[0] ?? '',
        identificacion: row[1] ?? '',
        medico: row[9] || 'Por asignar',
        motivo: row[11] || 'Consulta general',
        telefono: row[2] ?? '',
        nacimiento: row[3] ?? '',
        estado: row[5] ?? '',
      }))

      onAvisar('Generando directorio de pacientes en PDF...')
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

      onAvisar('Generando reporte general de citas...')
      exportarCitasPDF(citasParaExportar, { rol })
      return
    }

    onAvisar('Listado de ' + modulo + ' exportado')
  }

  const etiquetaBoton = modulo === 'Pacientes' ? 'Exportar directorio' : 'Exportar reporte'

  return (
    <ActionButton icon={Download} onClick={handleExportar}>
      {etiquetaBoton}
    </ActionButton>
  )
}
