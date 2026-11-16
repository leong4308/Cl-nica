import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function cargar(ruta, deps = {}) {
 const js = ts.transpileModule(readFileSync(new URL(ruta, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
 const exports = {}; new Function('require', 'exports', js)(id => deps[id] ?? require(id), exports); return exports
}
const reportes = cargar('../lib/exportar/reporte-clinico.ts')
test('el XLSX real conserva estilos, filtros, encabezados y texto sin ejecutar fórmulas', async () => {
 const ExcelJS = require('exceljs')
 const libro = await reportes.crearLibroReporte({ titulo: 'Censo hospitalario', subtitulo: 'Resultados filtrados', archivo: 'censo', columnas: ['Paciente', 'Estado'], filas: [['=HYPERLINK("https://ejemplo.test")', 'Alta'], ['Ana & familia', 'Ocupada']], columnaEstado: 1 })
 const copia = new ExcelJS.Workbook(); await copia.xlsx.load(await libro.xlsx.writeBuffer())
 const hoja = copia.worksheets[0]
 assert.equal(hoja.getCell('A1').value, 'CLÍNICA NOVA')
 assert.equal(hoja.getCell('B8').type, ExcelJS.ValueType.String)
 assert.equal(hoja.getCell('B8').value, '=HYPERLINK("https://ejemplo.test")')
 assert.equal(hoja.getCell('C8').font.bold, true)
 assert.equal(hoja.getCell('A7').fill.fgColor.argb, 'FF123453')
 assert.equal(hoja.getTable('DatosClinicos').table.tableRef, 'A7:C9')
 assert.equal(hoja.views[0].ySplit, 7)
 assert.equal(hoja.pageSetup.orientation, 'landscape')
})
test('la reserva HTTP ignora identidades del cliente y solo acepta turnos completos', async () => {
 let llamadas = [], a = { usuario: { rol: 'paciente' }, db: { rpc: async (nombre, params) => { llamadas.push({ nombre, params }); return { data: { id: 50 } } } } }
 const modelo = cargar('../lib/agenda/modelo.ts')
 const api = cargar('../app/api/citas/reservar/route.ts', { '@/lib/cuenta/servidor': { cuentaAutenticada: async () => a, origenValido: () => true }, '@/lib/supabase/error-operacion': cargar('../lib/supabase/error-operacion.ts'), '@/lib/agenda/modelo': modelo })
 const b = { medico: 1, inicio: '2027-01-01T10:00:00-06:00', fin: '2027-01-01T10:20:00-06:00', clave: '11111111-1111-4111-8111-111111111111', paciente: 999, usuarioId: 999 }
 const enviar = valor => api.POST(new Request('http://localhost/api/citas/reservar', { method: 'POST', body: JSON.stringify(valor) }))
 assert.equal((await enviar(b)).status, 200)
 assert.deepEqual(Object.keys(llamadas[0].params).sort(), ['p_clave', 'p_fin', 'p_inicio', 'p_medico', 'p_motivo'])
 for (const cambios of [{ medico: true }, { clave: 'inventada' }, { fin: b.inicio }, { inicio: '2027-01-01T10:00:00' }, { motivo: 'a'.repeat(1001) }]) assert.equal((await enviar({ ...b, ...cambios })).status, 400)
 assert.equal(llamadas.length, 1)
 a = { respuesta: Response.json({}, { status: 423 }) }; assert.equal((await enviar(b)).status, 423)
 a = { usuario: { rol: 'recepcionista' } }; assert.equal((await enviar(b)).status, 403)
})
