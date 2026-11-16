export type MedicamentoConsulta = { nombre: string; dosis: string; via: string; frecuencia: string; duracion: string }
export type ContenidoConsulta = { subjetivo: string; objetivo: string; diagnostico: string; plan: string; pronostico: string; seguimiento: string; recetaLibre: string; medicamentos: MedicamentoConsulta[] }
export const CONTENIDO_VACIO: ContenidoConsulta = { subjetivo: '', objetivo: '', diagnostico: '', plan: '', pronostico: '', seguimiento: '', recetaLibre: '', medicamentos: [] }
export type ConsultaMedica = {
  cita: { id: number; pacienteId: number; paciente: string; nacimiento: string | null; medico: string; cedula: string; inicio: string; estado: string; motivo: string | null; alertas: string | null }
  signos?: {valores:Record<string,number>;fecha:string;autor:string}|null
  version: string; puedeSolicitarCambio?: boolean; puedeEditar: boolean
  nota: { id: number; contenido: Partial<ContenidoConsulta>; estado_nota: string; diagnostico: string | null; receta: string | null; notas_doctor: string | null; cerrada_en: string | null } | null
  correcciones: { id: number; texto: string; motivo: string; fecha: string; autor: string }[]
  ordenes: { id: number; tipo: string; descripcion: string; instrucciones: string; estado: string }[]
  catalogo: { id: number; nombre: string }[]
}
export function contenidoInicial(nota: ConsultaMedica['nota']): ContenidoConsulta {
  const contenido = nota?.contenido ?? {}
  return { ...CONTENIDO_VACIO, diagnostico: nota?.diagnostico ?? '', recetaLibre: Object.keys(contenido).length ? '' : nota?.receta ?? '', subjetivo: Object.keys(contenido).length ? '' : nota?.notas_doctor ?? '', ...contenido, medicamentos: contenido.medicamentos ?? [] }
}
export async function operarMedico(accion: string, datos: Record<string, unknown>, clave: string) {
  const r = await fetch('/api/medico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, datos, clave }) })
  const b = await r.json()
  if (!r.ok) throw Error(b.error || 'No se pudo guardar la atención.')
  return b as { id?: number; mensaje: string }
}
const escapar = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export function recetaHTML(consulta: ConsultaMedica) {
  if (consulta.nota?.estado_nota !== 'cerrada') throw Error('Finaliza la nota antes de emitir su receta.')
  const d = contenidoInicial(consulta.nota), c = consulta.cita
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Receta · Clínica Nova</title><style>@page{size:A4;margin:20mm}body{font:14px Arial;color:#18324b;max-width:800px;margin:30px auto;padding:20px}header{border-bottom:3px solid #16a69b;padding-bottom:20px}h1{font-size:28px}h2{font-size:19px}small{color:#617589}section{padding:20px 0;border-bottom:1px solid #dce6ed}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #e4ebf1;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#edf5f8}.nota{white-space:pre-wrap}button{padding:12px;background:#174b76;color:white;border:0;border-radius:8px}@media print{button{display:none}body{margin:0;padding:0}}</style><button onclick="window.print()">Guardar PDF / Imprimir</button><header><h1>Clínica Nova</h1><small>Prescripción vinculada a la consulta #${c.id}</small></header><section><h2>${escapar(c.paciente)}</h2><p>Médico: ${escapar(c.medico)} · Cédula: ${escapar(c.cedula)}</p><p>${consulta.nota.cerrada_en ? 'Fecha de cierre registrada' : 'Fecha de consulta'}: ${escapar(new Date(consulta.nota.cerrada_en ?? c.inicio).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }))}</p></section><section><h2>Indicaciones</h2>${d.medicamentos.length ? `<table><thead><tr>${['Medicamento', 'Dosis', 'Vía', 'Frecuencia', 'Duración'].map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>${d.medicamentos.map(m => `<tr>${[m.nombre, m.dosis, m.via, m.frecuencia, m.duracion].map(v => `<td>${escapar(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : d.recetaLibre ? '' : '<p>No se registraron medicamentos en esta nota.</p>'}${d.recetaLibre ? `<p class="nota">${escapar(d.recetaLibre)}</p>` : ''}<p class="nota">${escapar(d.plan)}</p></section><section><h2>Seguimiento</h2><p class="nota">${escapar(d.seguimiento || 'Según indicaciones del médico tratante.')}</p></section>${consulta.correcciones.length ? `<section><h2>Aclaraciones posteriores</h2>${consulta.correcciones.map(r => `<p class="nota">${escapar(r.texto)}<br><small>${escapar(r.autor)} · ${escapar(r.fecha)}</small></p>`).join('')}</section>` : ''}<footer><p>Nombre y firma del médico: __________________________</p><small>Documento generado a partir de la nota clínica cerrada. Información confidencial.</small></footer></html>`
}
export function imprimirReceta(consulta: ConsultaMedica) {
  const html = recetaHTML(consulta), ventana = window.open('', '_blank')
  if (!ventana) throw Error('Permite abrir la ventana de la receta para imprimir o guardar su PDF.')
  ventana.opener = null; ventana.document.write(html); ventana.document.close()
}
