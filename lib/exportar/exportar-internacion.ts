export type InternacionExportar = {
  ubicacion: string
  paciente: string
  ingreso: string
  medico: string
  estado: string
}

export function exportarInternacionExcel(internaciones: InternacionExportar[]): void {
  const encabezados = ['Habitacion / Cama', 'Paciente', 'Fecha de Ingreso', 'Medico Tratante', 'Estado']
  const celda = (valor: string) => '"' + (/^[=+\-@\t\r]/.test(valor) ? "'" + valor : valor).replace(/"/g, '""') + '"'
  const lineas = internaciones.map((i) => [i.ubicacion, i.paciente, i.ingreso, i.medico, i.estado].map((valor) => celda(valor || '')).join(','))

  const contenidoCsv = '\uFEFF' + [encabezados.join(','), ...lineas].join('\r\n')
  const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'internacion_camas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function exportarInternacionPDF(internaciones: InternacionExportar[]): boolean {
  const ventana = window.open('', '_blank')
  if (!ventana) return false
  ventana.opener = null
  const escapar = (valor: string) => String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

  const filasHtml = internaciones.map((i, idx) => 
    '<tr style="border-bottom: 1px solid #e2e8f0; ' + (idx % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;') + '">' +
    '<td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">' + escapar(i.ubicacion) + '</td>' +
    '<td style="padding: 10px 12px; font-weight: 500; color: #0f172a;">' + escapar(i.paciente) + '</td>' +
    '<td style="padding: 10px 12px; color: #475569;">' + escapar(i.ingreso) + '</td>' +
    '<td style="padding: 10px 12px; color: #475569;">' + escapar(i.medico) + '</td>' +
    '<td style="padding: 10px 12px; font-semibold;">' + escapar(i.estado) + '</td>' +
    '</tr>'
  ).join('')

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Censo de Hospitalizacion y Camas</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a} .header{display:flex;justify-content:space-between;border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:20px} table{width:100%;border-collapse:collapse;font-size:12px} th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:11px} .btn{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;margin-bottom:16px} @media print{.no-print{display:none}}</style></head><body><div class="no-print"><button class="btn" onclick="window.print()">Guardar como PDF / Imprimir</button></div><div class="header"><div><h1 style="margin:0;color:#1e40af;font-size:22px">Clinica Nova</h1><p style="margin:4px 0 0 0;color:#64748b;font-size:12px">Censo Hospitalario y Estado de Camas</p></div><div style="text-align:right;font-size:12px;color:#64748b"><p style="margin:0">Total registros: ' + internaciones.length + '</p></div></div><table><thead><tr><th>Ubicacion / Cama</th><th>Paciente</th><th>Fecha Ingreso</th><th>Medico Tratante</th><th>Estado</th></tr></thead><tbody>' + filasHtml + '</tbody></table></body></html>'

  ventana.document.write(html)
  ventana.document.close()
  return true
}
