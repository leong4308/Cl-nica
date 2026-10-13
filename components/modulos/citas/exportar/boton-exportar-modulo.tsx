'use client'

import { Download } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'
import type { Row } from '../../compartidos/types'
import { exportarCitasPDF, type CitaExportar } from '@/lib/exportar/exportar-citas-pdf'

export function BotonExportarModulo({
  modulo,
  filas = [],
  onAvisar,
}: {
  modulo: string
  filas?: Row[]
  onAvisar: (mensaje: string) => void
}) {
  const handleExportar = () => {
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

      onAvisar(`Generando agenda médica en PDF (${citasParaExportar.length} citas)...`)
      exportarCitasPDF(citasParaExportar)
      return
    }

    onAvisar(`Listado de ${modulo} exportado`)
  }

  return (
    <ActionButton icon={Download} onClick={handleExportar}>
      Exportar
    </ActionButton>
  )
}
