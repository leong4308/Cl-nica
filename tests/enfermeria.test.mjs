import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function cargar(ruta, deps = {}) { const js = ts.transpileModule(readFileSync(new URL(ruta, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; const exports = {}; new Function('require', 'exports', js)(id => deps[id] ?? (id === '@/lib/cuenta/validacion' ? cargar('../lib/cuenta/validacion.ts') : require(id)), exports); return exports }
test('la API de enfermería exige sesión y rol y solo transmite operaciones tipadas al RPC', async () => {
 let acceso = { respuesta: Response.json({}, { status: 423 }) }, llamadas = []
 const errorOperacion = cargar('../lib/supabase/error-operacion.ts').errorOperacion
 const api = cargar('../app/api/enfermeria/route.ts', { '@/lib/cuenta/servidor': { cuentaAutenticada: async () => acceso, origenValido: () => true }, '@/lib/supabase/error-operacion': { errorOperacion } })
 const enviar = b => api.POST(new Request('http://localhost/api/enfermeria', { method: 'POST', body: JSON.stringify(b) }))
 const b = { accion: 'nota', datos: { pacienteId: 1, texto: 'Registro' }, clave: '11111111-1111-4111-8111-111111111111' }
 assert.equal((await enviar(b)).status, 423)
 acceso = { usuario: { rol: 'paciente' } }; assert.equal((await api.GET()).status, 403)
 acceso = { usuario: { rol: 'enfermero' }, db: { rpc: async (nombre, datos) => { llamadas.push({ nombre, datos }); return { data: { id: 1 } } } } }
 for (const cambios of [{ accion: 'SQL libre' }, { clave: 'inventada' }, { datos: [] }, { datos: { texto: 'a'.repeat(21000) } }]) assert.equal((await enviar({ ...b, ...cambios })).status, 400)
 assert.equal(llamadas.length, 0)
 const r = await enviar(b); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'private, no-store')
 assert.deepEqual(llamadas[0], { nombre: 'clinica_enfermeria_operar', datos: { p_accion: 'nota', p_datos: b.datos, p_clave: b.clave } })
 for(const datos of [{telefono:'123'},{telefono:'12345678901'},{telefono:'961-123-4567'},{contacto:'Ana López',telefonoEmergencia:''},{contacto:'',telefonoEmergencia:'9611234567'}]) assert.equal((await enviar({...b,accion:'contacto',datos})).status,400)
 assert.equal(llamadas.length,1)
 assert.equal((await enviar({...b,accion:'contacto',datos:{telefono:'0123456789',contacto:'Ana López',telefonoEmergencia:'9611234567'}})).status,200)
})
