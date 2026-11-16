import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function cargar(ruta,deps={}){const js=ts.transpileModule(readFileSync(new URL(ruta,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new Function('require','exports',js)(id=>deps[id]??require(id),exports);return exports}
const agenda=cargar('../lib/agenda/modelo.ts')
const modelo=cargar('../lib/recepcion/modelo.ts',{'@/lib/agenda/modelo':agenda})
const ahora=Date.parse('2026-11-12T18:00:00Z')
const cita={id:1,pacienteId:1,paciente:'Paciente',medicoId:1,medico:'Médico',inicio:'2026-11-12T20:00:00Z',fin:'2026-11-12T20:20:00Z',estado:'confirmada',llegada:null,enConsulta:null,version:'a'.repeat(32)}
test('la llegada y el inicio son distintos de la finalización y las métricas no duplican el total',()=>{
 const espera={...cita,id:2,llegada:'2026-11-12T17:40:00Z'},consulta={...espera,id:3,enConsulta:'2026-11-12T17:55:00Z'}
 assert.equal(modelo.etapaCita(espera),'En espera');assert.equal(modelo.etapaCita(consulta),'En consulta');assert.equal(modelo.etapaCita({...consulta,estado:'atendida'}),'Finalizada')
 assert.equal(modelo.esperaMinutos(espera,ahora),20);assert.equal(modelo.esperaMinutos(consulta,ahora),15)
 assert.deepEqual(modelo.indicadores([cita,espera,consulta,{...cita,estado:'atendida'},{...cita,estado:'cancelada_paciente'}]),{total:5,pendientes:2,espera:1,consulta:1,finalizadas:1,canceladas:1})
})
test('el límite de reagenda es estricto y la llegada impide mover el turno',()=>{
 assert.equal(modelo.puedeReagendar(cita,ahora),false)
 assert.equal(modelo.puedeReagendar(cita,ahora-1),true)
 assert.equal(modelo.puedeReagendar({...cita,llegada:'2026-11-12T17:40:00Z'},ahora-1),false)
})
test('el directorio distingue jornada, descanso y horario no publicado con hora de México',()=>{
 const medico={bloques:[{dia:4,inicio:'08:00',fin:'20:00'}],descansos:[]}
 assert.equal(modelo.estadoMedico(medico,'2026-11-12',ahora),'En horario de consulta')
 assert.equal(modelo.estadoMedico({...medico,descansos:[{fecha:'2026-11-12',inicio:'12:00',fin:'13:00'}]},'2026-11-12',ahora),'En descanso')
 assert.equal(modelo.estadoMedico(medico,'2026-11-13',ahora),'Día de descanso')
 assert.equal(modelo.estadoMedico({bloques:[]},'2026-11-12',ahora),'Horario no publicado')
})
test('API exige sesión, rol y origen y deriva el actor en SQL; no acepta finalizar consultas',async()=>{
 let acceso={respuesta:Response.json({}, {status:423})},origen=true,llamadas=[]
 const api=cargar('../app/api/recepcion/route.ts',{'@/lib/cuenta/servidor':{cuentaAutenticada:async()=>acceso,origenValido:()=>origen},'@/lib/supabase/error-operacion':cargar('../lib/supabase/error-operacion.ts')})
 const b={citaId:1,version:'a'.repeat(32),accion:'llegada',clave:'11111111-1111-4111-8111-111111111111'}
 const enviar=cuerpo=>api.POST(new Request('http://localhost/api/recepcion',{method:'POST',body:JSON.stringify(cuerpo)}))
 assert.equal((await enviar(b)).status,423)
 acceso={usuario:{rol:'paciente'}};assert.equal((await enviar(b)).status,403)
 acceso={usuario:{rol:'recepcionista'},db:{rpc:async(nombre,parametros)=>{llamadas.push({nombre,parametros});return {data:{ok:true}}}}}
 origen=false;assert.equal((await enviar(b)).status,403);origen=true
 for(const cambio of [{accion:'atendida'},{citaId:0},{clave:'falsa'},{version:'vieja'},{motivo:'x'.repeat(1100)}])assert.equal((await enviar({...b,...cambio})).status,400)
 assert.equal(llamadas.length,0)
 const r=await enviar({...b,actor:999});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok(!('actor' in llamadas[0].parametros))
 assert.equal((await api.GET(new Request('http://localhost/api/recepcion?dia=2026-02-30'))).status,400)
 acceso.usuario.rol='medico';assert.equal((await api.GET(new Request('http://localhost/api/recepcion'))).status,403)
 assert.equal((await api.GET(new Request('http://localhost/api/recepcion?cita=1'))).status,200)
 assert.equal(llamadas.at(-1).nombre,'clinica_recepcion_estado')
})
test('el listado de recepción usa exclusivamente el RPC administrativo',async()=>{
 const {listarPacientes}=cargar('../lib/pacientes/listado.ts')
 const db={from(){throw Error('No debe consultar notas clínicas')},rpc:async nombre=>{assert.equal(nombre,'clinica_directorio_recepcion');return {data:[{id:1,usuarios:{nombre_completo:'Paciente'}}]}}}
 assert.equal((await listarPacientes(db,{id:4,rol:'recepcionista'}))[0].id,1)
})
