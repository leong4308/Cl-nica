import { descargarExcel, imprimirReporte, type ReporteClinico } from './reporte-clinico'
export type InternacionExportar = { ubicacion: string; paciente: string; ingreso: string; medico: string; estado: string }
function reporte(filas: InternacionExportar[]): ReporteClinico {
 return {titulo:'Censo de hospitalización',subtitulo:'Ubicación, ingreso y seguimiento de los pacientes hospitalizados.',archivo:'internacion_camas',columnas:['Habitación / cama','Paciente','Fecha de ingreso','Médico responsable','Estado'],columnaEstado:4,filas:filas.map(i=>[i.ubicacion,i.paciente,i.ingreso,i.medico,i.estado]),resumen:[{etiqueta:'Hospitalizaciones incluidas',valor:filas.length},{etiqueta:'Ingresos activos',valor:filas.filter(i=>/^(activa|ocupada|hospitalizado)$/i.test(i.estado)).length},{etiqueta:'Altas registradas',valor:filas.filter(i=>/^alta$/i.test(i.estado)).length}]}
}
export function exportarInternacionExcel(filas: InternacionExportar[]) { return descargarExcel(reporte(filas)) }
export function exportarInternacionPDF(filas: InternacionExportar[]) { return imprimirReporte(reporte(filas)) }
