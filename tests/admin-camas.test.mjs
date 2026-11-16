import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function cargar(ruta,deps={}){const js=ts.transpileModule(readFileSync(new URL(ruta,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new Function('require','exports',js)(id=>deps[id]??require(id),exports);return exports}

test('API del catálogo exige sesión activa, administrador y origen; deriva autor en SQL',async()=>{
 let acceso={respuesta:Response.json({}, {status:423})},origen=true,llamadas=[]
 const api=cargar('../app/api/admin/camas/route.ts',{'@/lib/cuenta/servidor':{cuentaAutenticada:async()=>acceso,origenValido:()=>origen},'@/lib/supabase/error-operacion':cargar('../lib/supabase/error-operacion.ts')})
 const b={accion:'crear_cama',datos:{habitacionId:1,numero:'A'},clave:'11111111-1111-4111-8111-111111111111'}
 const enviar=cuerpo=>api.POST(new Request('http://localhost/api/admin/camas',{method:'POST',body:JSON.stringify(cuerpo)}))
 assert.equal((await api.GET()).status,423);assert.equal((await enviar(b)).status,423)
 for(const rol of ['paciente','recepcionista','medico','enfermero']){acceso={usuario:{rol}};assert.equal((await api.GET()).status,403);assert.equal((await enviar(b)).status,403)}
 acceso={usuario:{rol:'admin'},db:{rpc:async(nombre,parametros)=>{llamadas.push({nombre,parametros});return {data:{ok:true}}}}}
 origen=false;assert.equal((await enviar(b)).status,403);origen=true
 for(const cambio of [{accion:'alta'},{datos:[]},{clave:'falsa'}])assert.equal((await enviar({...b,...cambio})).status,400)
 assert.equal((await enviar({...b,datos:{motivo:'x'.repeat(7000)}})).status,413)
 const r=await enviar({...b,actor:999});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.deepEqual(llamadas[0].parametros,{p_accion:b.accion,p_datos:b.datos,p_clave:b.clave})
 assert.equal((await api.GET()).status,200);assert.equal(llamadas.at(-1).nombre,'clinica_catalogo_camas')
})
test('una cama libre deshabilitada no es disponible',()=>{
 const {disponibleCama}=cargar('../lib/internacion/catalogo.ts')
 assert.equal(disponibleCama({ocupada:false,habilitada:false}),false)
 assert.equal(disponibleCama({ocupada:true,habilitada:true}),false)
 assert.equal(disponibleCama({ocupada:false,habilitada:true}),true)
})
test('la llegada administrativa usa la versión vigente, sin finalizar la consulta',async()=>{
 const anteriorFetch=global.fetch,anteriorWindow=global.window,llamadas=[]
 global.window={dispatchEvent(e){llamadas.push(e.type)}}
 global.fetch=async(url,op)=>{llamadas.push({url,op});return Response.json(op?.method==='POST'?{ok:true}:{version:'a'.repeat(32)})}
 try{
  const {registrarLlegadaCita}=cargar('../lib/recepcion/llegada.ts')
  assert.equal(await registrarLlegadaCita(35),null)
  const post=JSON.parse(llamadas[1].op.body);assert.equal(post.accion,'llegada');assert.equal(post.citaId,35);assert.equal(post.version,'a'.repeat(32));assert.equal(post.estado,undefined)
  assert.equal(llamadas[2],'datos-actualizados')
  global.fetch=async()=>Response.json({error:'La cita cambió'},{status:409})
  assert.equal(await registrarLlegadaCita(35),'La cita cambió')
 }finally{global.fetch=anteriorFetch;global.window=anteriorWindow}
})
