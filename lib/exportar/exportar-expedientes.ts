export type ExpedienteExportar = {
  paciente: string
  motivo: string
  diagnostico: string
  medico: string
  actualizado: string
}

export function exportarExpedientesExcel(expedientes: ExpedienteExportar[]): void {
  const encabezados = ['Paciente', 'Motivo de Consulta', 'Diagnostico Medico', 'Medico Tratante', 'Fecha de Actualizacion']
  const lineas = expedientes.map((e) => [
    '"' + (e.paciente || '').replace(/"/g, '""') + '"',
    '"' + (e.motivo || '').replace(/"/g, '""') + '"',
    '"' + (e.diagnostico || '').replace(/"/g, '""') + '"',
    '"' + (e.medico || '').replace(/"/g, '""') + '"',
    '"' + (e.actualizado || '').replace(/"/g, '""') + '"',
  ].join(','))

  const contenidoCsv = '\uFEFF' + [encabezados.join(','), ...lineas].join('\r\n')
  const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'expedientes_clinicos.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function exportarExpedientesPDF(expedientes: ExpedienteExportar[]): void {
  const ventana = window.open('', '_blank')
  if (!ventana) return

  const filasHtml = expedientes.map((e, idx) => 
    '<tr style="border-bottom: 1px solid #e2e8f0; ' + (idx % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;') + '">' +
    '<td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">' + e.paciente + '</td>' +
    '<td style="padding: 10px 12px; color: #475569;">' + e.motivo + '</td>' +
    '<td style="padding: 10px 12px; color: #334155; font-weight: 500;">' + e.diagnostico + '</td>' +
    '<td style="padding: 10px 12px; color: #475569;">' + e.medico + '</td>' +
    '<td style="padding: 10px 12px; color: #64748b; font-size: 11px;">' + e.actualizado + '</td>' +
    '</tr>'
  ).join('')

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Historia Clinica - Expedientes</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a} .header{display:flex;justify-content:space-between;border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:20px} table{width:100%;border-collapse:collapse;font-size:12px} th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:11px} .btn{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;margin-bottom:16px} @media print{.no-print{display:none}}</style></head><body><div class="no-print"><button class="btn" onclick="window.print()">Guardar como PDF / Imprimir</button></div><div class="header"><div><h1 style="margin:0;color:#1e40af;font-size:22px">Clinica Nova</h1><p style="margin:4px 0 0 0;color:#64748b;font-size:12px">Reporte de Historias Clinicas y Expedientes</p></div><div style="text-align:right;font-size:12px;color:#64748b"><p style="margin:0">Total expedientes: ' + expedientes.length + '</p></div></div><table><thead><tr><th>Paciente</th><th>Motivo</th><th>Diagnostico</th><th>Medico</th><th>Actualizado</th></tr></thead><tbody>' + filasHtml + '</tbody></table></body></html>'

  ventana.document.write(html)
  ventana.document.close()
}
