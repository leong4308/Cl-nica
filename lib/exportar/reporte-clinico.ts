export type ReporteClinico = {
  titulo: string; subtitulo: string; archivo: string; columnas: string[]; filas: string[][]
  resumen?: { etiqueta: string; valor: number | string }[]; columnaEstado?: number
}
const escapar = (v: unknown) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const fechaEmision = () => new Date().toLocaleString('es-MX',{timeZone:'America/Mexico_City',dateStyle:'long',timeStyle:'short'})
const estiloEstado = (valor: string) => /cancel|inactiv|baja/i.test(valor)?'rojo':/alta|confirm|activ|atendid|complet/i.test(valor)?'verde':/pend|proceso|ocupad|hospitaliz/i.test(valor)?'ambar':'gris'

export function construirReporteHTML(r: ReporteClinico) {
  const resumen=r.resumen??[{etiqueta:'Registros incluidos',valor:r.filas.length}]
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${escapar(r.titulo)} · Clínica Nova</title><style>
  @page{size:A4 landscape;margin:14mm 12mm}*{box-sizing:border-box}body{margin:0;background:#edf2f7;color:#18324b;font:13px 'Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .acciones{max-width:1120px;margin:20px auto;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 6px}.acciones p{color:#53687c}.acciones button{border:0;border-radius:10px;background:#164c78;color:white;padding:12px 20px;font-weight:600;cursor:pointer}
  .hoja{max-width:1120px;margin:0 auto 30px;background:white;padding:38px 42px;border-radius:18px;box-shadow:0 8px 32px #18324b12}.marca{display:flex;gap:12px;align-items:center}.logo{background:#123453;color:white;padding:11px;border-radius:12px}.marca strong{font-size:22px;letter-spacing:-.5px}.marca small{display:block;margin-top:5px;color:#64788b;letter-spacing:1.6px;font-size:9px;text-transform:uppercase}
  header{display:flex;justify-content:space-between;gap:24px;padding-bottom:24px;border-bottom:3px solid #16a69b}.emision{text-align:right;color:#687d90;font-size:11px;line-height:1.6}.emision b{color:#18324b}h1{font-size:26px;font-weight:650;letter-spacing:-.6px;margin:28px 0 8px}.subtitulo{color:#63788c;line-height:1.5;margin:0}.resumen{display:flex;gap:14px;margin:24px 0}.dato{flex:1;background:#f3f7fa;border:1px solid #e2eaf1;border-radius:12px;padding:14px 18px}.dato b{display:block;font-size:23px;color:#123453}.dato span{display:block;font-size:11px;color:#64788b;margin-top:5px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}thead{display:table-header-group}th{text-align:left;background:#123453;color:white;padding:13px 11px;font-size:10px;letter-spacing:.4px}th:first-child{width:38px}td{padding:13px 11px;vertical-align:top;line-height:1.6;border-bottom:1px solid #e6edf3;overflow-wrap:anywhere;white-space:pre-wrap}tbody tr:nth-child(even){background:#f6f9fb}tbody tr{break-inside:avoid}td.numero{font-size:10px;color:#8a9aab}.estado{display:inline-block;border-radius:20px;padding:3px 9px;white-space:normal;font-size:10px;font-weight:600}.verde{background:#e2f5ec;color:#157251}.rojo{background:#fceced;color:#b33b4b}.ambar{background:#fff2d8;color:#906316}.gris{background:#e9eef4;color:#53687c}.vacio{text-align:center;padding:26px;color:#6e8194}footer{display:flex;justify-content:space-between;gap:16px;margin-top:24px;border-top:1px solid #e3eaf1;padding-top:14px;color:#768a9d;font-size:10px;line-height:1.6}
  @media print{body{background:white}.acciones{display:none}.hoja{max-width:none;margin:0;padding:0;border-radius:0;box-shadow:none}h1{font-size:23px}header{break-inside:avoid}.resumen{break-inside:avoid}footer{break-inside:avoid}}@media(max-width:700px){.hoja{padding:22px}.acciones{padding:0 20px}.emision{max-width:160px}.resumen{flex-wrap:wrap}.dato{min-width:120px}}
  </style></head><body><div class="acciones"><p>Vista del reporte · Los filtros de la pantalla se conservan</p><button type="button" onclick="window.print()">Guardar como PDF / Imprimir</button></div><article class="hoja"><header><div class="marca"><div class="logo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3 12h5l2-4 3 8 2-4h6"/></svg></div><div><strong>Clínica Nova</strong><small>Atención y seguimiento clínico</small></div></div><div class="emision"><b>Fecha de emisión</b><br>${escapar(fechaEmision())}<br>Hora de Ciudad de México</div></header><h1>${escapar(r.titulo)}</h1><p class="subtitulo">${escapar(r.subtitulo)}</p><section class="resumen">${resumen.map(x=>`<div class="dato"><b>${escapar(x.valor)}</b><span>${escapar(x.etiqueta)}</span></div>`).join('')}</section><table><thead><tr><th>#</th>${r.columnas.map(c=>`<th>${escapar(c)}</th>`).join('')}</tr></thead><tbody>${r.filas.length?r.filas.map((fila,i)=>`<tr><td class="numero">${String(i+1).padStart(2,'0')}</td>${r.columnas.map((_,j)=>`<td>${j===r.columnaEstado?`<span class="estado ${estiloEstado(fila[j]??'')}">${escapar(fila[j]||'—')}</span>`:escapar(fila[j]||'—')}</td>`).join('')}</tr>`).join(''):`<tr><td class="vacio" colspan="${r.columnas.length+1}">No hay registros para los filtros seleccionados.</td></tr>`}</tbody></table><footer><span>Información confidencial · Uso autorizado por Clínica Nova</span><span>${r.filas.length} registro(s) · Fin del reporte</span></footer></article></body></html>`
}

export function imprimirReporte(r: ReporteClinico): boolean {
  const ventana=window.open('','_blank');if(!ventana)return false
  ventana.opener=null;ventana.document.write(construirReporteHTML(r));ventana.document.close();return true
}

export async function crearLibroReporte(r: ReporteClinico) {
  const modulo=await import('exceljs'),ExcelJS=modulo.default??modulo
  const libro=new ExcelJS.Workbook();libro.creator='Clínica Nova';libro.created=new Date()
  const hoja=libro.addWorksheet('Reporte',{views:[{state:'frozen',ySplit:7}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}})
  const cantidad=r.columnas.length+1
  hoja.mergeCells(1,1,1,cantidad);hoja.getCell(1,1).value='CLÍNICA NOVA';hoja.getRow(1).height=34
  hoja.getCell(1,1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123453'}};hoja.getCell(1,1).font={name:'Aptos',size:19,bold:true,color:{argb:'FFFFFFFF'}}
  hoja.mergeCells(2,1,2,cantidad);hoja.getCell(2,1).value=r.titulo;hoja.getCell(2,1).font={name:'Aptos',size:16,bold:true,color:{argb:'FF123453'}};hoja.getRow(2).height=30
  hoja.mergeCells(3,1,3,cantidad);hoja.getCell(3,1).value=r.subtitulo;hoja.getCell(3,1).font={size:11,color:{argb:'FF64788B'}};hoja.getRow(3).height=23
  hoja.mergeCells(4,1,4,cantidad);hoja.getCell(4,1).value='Emitido el '+fechaEmision()+' · Ciudad de México';hoja.getCell(4,1).font={size:10,color:{argb:'FF64788B'}}
  hoja.mergeCells(5,1,5,cantidad);hoja.getCell(5,1).value=(r.resumen??[{etiqueta:'Registros',valor:r.filas.length}]).map(x=>`${x.etiqueta}: ${x.valor}`).join('    ·    ');hoja.getCell(5,1).font={bold:true,size:11,color:{argb:'FF14776C'}};hoja.getRow(5).height=26
  hoja.addTable({name:'DatosClinicos',ref:'A7',headerRow:true,totalsRow:false,style:{theme:'TableStyleMedium2',showRowStripes:true},columns:[{name:'#',filterButton:false},...r.columnas.map(name=>({name,filterButton:true}))],rows:r.filas.map((fila,i)=>[i+1,...r.columnas.map((_,j)=>String(fila[j]??''))])})
  hoja.getRow(7).height=27;hoja.getRow(7).eachCell(c=>{c.font={name:'Aptos',bold:true,size:11,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123453'}};c.alignment={vertical:'middle',wrapText:true}})
  hoja.getColumn(1).width=7
  r.columnas.forEach((nombre,j)=>{hoja.getColumn(j+2).width=Math.min(40,r.filas.reduce((max,f)=>Math.max(max,Math.min(36,(f[j]??'').length+2)),Math.max(19,nombre.length+4)))})
  r.filas.forEach((fila,i)=>{const row=hoja.getRow(i+8);row.height=Math.min(90,Math.max(32,...fila.map(c=>Math.ceil(String(c).length/34)*16)));row.eachCell(c=>{c.font={name:'Aptos',size:11,color:{argb:'FF223E57'}};c.alignment={vertical:'middle',wrapText:true};c.border={bottom:{style:'hair',color:{argb:'FFE1EAF1'}}}});if(r.columnaEstado!==undefined){const cell=row.getCell(r.columnaEstado+2),clase=estiloEstado(fila[r.columnaEstado]??'');cell.font={bold:true,color:{argb:clase==='verde'?'FF147252':clase==='rojo'?'FFB33B4B':'FF906316'}}}})
  hoja.headerFooter.oddFooter='&LClínica Nova · Información confidencial&R&P / &N';hoja.pageSetup.printTitlesRow='1:7';hoja.pageSetup.printArea=`A1:${hoja.getColumn(cantidad).letter}${r.filas.length+7}`
  return libro
}
export async function descargarExcel(r: ReporteClinico) {
  const libro=await crearLibroReporte(r),datos=await libro.xlsx.writeBuffer(),blob=new Blob([Uint8Array.from(datos as unknown as Uint8Array)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=r.archivo+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
