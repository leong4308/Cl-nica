'use client'

import { Download } from 'lucide-react'
import { ActionButton } from '../../compartidos/ui'
import type { Row } from '../../compartidos/types'
import { exportarCitasPDF, type CitaExportar } from '@/lib/exportar/exportar-citas-pdf'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

function normalizarTexto(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(dr\.|dra\.|doctor|doctora)\s+/i, '')
    .trim()
}

export function BotonExportarModulo({
  modulo,
  filas = [],
  onAvisar,
  rol,
  nombreUsuario,
}: {
  modulo: string
  filas?: Row[]
  onAvisar: (mensaje: string) => void
  rol?: RolUsuario
  nombreUsuario?: string
}) {
  const esMedico = rol === 'medico'
  const esAdmin = rol === 'admin'

  // Regla 1: Un médico solo puede exportar dentro del módulo Citas (su propia agenda).
  if (esMedico && modulo !== 'Citas') {
    return null
  }

  // Regla 2: El padrón de Pacientes solo puede ser exportado por Administradores.
  if (modulo === 'Pacientes' && !esAdmin) {
    return null
  }

  const handleExportar = () => {
    // Protección adicional en ejecución
    if (modulo === 'Pacientes' && !esAdmin) {
      onAvisar('Acceso restringido: solo el administrador puede exportar el padrón de pacientes')
      return
    }

    if (modulo === 'Citas') {
      let filasExportar = filas

      // Si es médico, filtrar únicamente las citas asignadas a él/ella
      if (esMedico && nombreUsuario) {
        const buscado = normalizarTexto(nombreUsuario)
        filasExportar = filas.filter((row) => {
          const nombreMedicoFila = normalizarTexto(row[2] ?? '')
          return (
            nombreMedicoFila.includes(buscado) ||
            buscado.includes(nombreMedicoFila) ||
            buscado.split(' ').some((palabra) => palabra.length > 2 && nombreMedicoFila.includes(palabra))
          )
        })

        if (filasExportar.length === 0) {
          onAvisar('No tienes citas asignadas en este listado para exportar')
          return
        }
      }

      if (filasExportar.length === 0) {
        onAvisar('No hay citas disponibles para exportar')
        return
      }

      const citasParaExportar: CitaExportar[] = filasExportar.map((row) => ({
        hora: row[0] ?? '',
        paciente: row[1] ?? '',
        medico: row[2] ?? '',
        motivo: row[3] ?? '',
        estado: row[4] ?? '',
        inicio: row[6],
        fin: row[7],
      }))

      onAvisar(
        esMedico
          ? `Generando tu agenda médica en PDF (${citasParaExportar.length} citas)...`
          : `Generando agenda médica en PDF (${citasParaExportar.length} citas)...`
      )
      exportarCitasPDF(citasParaExportar)
      return
    }

    onAvisar(`Listado de ${modulo} exportado`)
  }

  const etiquetaBoton = esMedico && modulo === 'Citas' ? 'Exportar mi agenda' : 'Exportar'

  return (
    <ActionButton icon={Download} onClick={handleExportar}>
      {etiquetaBoton}
    </ActionButton>
  )
}
