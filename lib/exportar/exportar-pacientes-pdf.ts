import { imprimirReporte } from './reporte-clinico'
export type PacienteExportar = { hora?: string; nombre: string; identificacion: string; medico?: string; motivo?: string; telefono: string; nacimiento?: string; estado: string }
export function exportarPacientesPDF(pacientes: PacienteExportar[], rol?: string) {
 return imprimirReporte({titulo:rol==='recepcionista'?'Directorio de pacientes · Recepción':'Directorio de pacientes',subtitulo:'Datos de identificación, contacto y seguimiento registrados.',archivo:'directorio_pacientes',columnas:['Paciente','Identificación','Médico','Teléfono','Nacimiento','Estado'],columnaEstado:5,filas:pacientes.map(p=>[p.nombre,p.identificacion,p.medico||'Sin médico asignado',p.telefono,p.nacimiento||'Sin registro',p.estado]),resumen:[{etiqueta:'Pacientes incluidos',valor:pacientes.length},{etiqueta:'Activos',valor:pacientes.filter(p=>/^activo$/i.test(p.estado)).length}]})
}
