import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const cuentas = JSON.parse(readFileSync(new URL('../lib/cuenta/cuentas-prueba.json', import.meta.url),'utf8'))
const codigo = ts.transpileModule(readFileSync(new URL('../app/api/accesos-prueba/route.ts',import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText
const api = {};new Function('require','exports',codigo)((id)=> id === '@/lib/cuenta/cuentas-prueba.json' ? cuentas : require(id),api)
async function consultar(entorno, ajuste, clave) {
  const original={ NODE_ENV: process.env.NODE_ENV, HABILITAR_ACCESOS_PRUEBA: process.env.HABILITAR_ACCESOS_PRUEBA, CLAVE_CUENTAS_PRUEBA: process.env.CLAVE_CUENTAS_PRUEBA }
  try {
    process.env.NODE_ENV=entorno
    for (const [nombre,valor] of Object.entries({ HABILITAR_ACCESOS_PRUEBA: ajuste, CLAVE_CUENTAS_PRUEBA: clave })) { if(valor===undefined)delete process.env[nombre];else process.env[nombre]=valor }
    const respuesta=api.GET();return { datos: await respuesta.json(), cache: respuesta.headers.get('Cache-Control') }
  } finally { for(const [k,v] of Object.entries(original)) {if(v===undefined)delete process.env[k];else process.env[k]=v} }
}
test('producción oculta cuentas y contraseña de prueba por defecto', async()=>{
  const {datos,cache}=await consultar('production')
  assert.deepEqual(datos,{habilitado:false});assert.match(cache,/no-store/)
})
test('desarrollo ofrece los cinco roles y las cuentas actuales',async()=>{
  const {datos}=await consultar('development')
  assert.equal(datos.habilitado,true);assert.equal(datos.clave,'Clinica123*')
  assert.deepEqual(new Set(datos.cuentas.map(c=>c.rol)),new Set(['admin','medico','enfermero','recepcionista','paciente']))
  assert.ok(datos.cuentas.some(c=>c.correo==='enfermero@clinicanova.com'))
  assert.ok(datos.cuentas.some(c=>c.correo==='recepcionista@clinicanova.com'))
  assert.ok(!datos.cuentas.some(c=>c.correo==='doc@doc.com'))
})
test('configuración explícita habilita pruebas desplegadas o desactiva desarrollo',async()=>{
  assert.equal((await consultar('production','true')).datos.habilitado,true)
  assert.deepEqual((await consultar('development','false')).datos,{habilitado:false})
})
test('contraseña de pruebas configurada llega sin exponer variables de servicio',async()=>{
  const {datos}=await consultar('development',undefined,'ClaveConfigurada123*')
  assert.equal(datos.clave,'ClaveConfigurada123*')
  assert.deepEqual(Object.keys(datos).sort(),['clave','cuentas','habilitado'])
})
