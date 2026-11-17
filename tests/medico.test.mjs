import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function cargar(ruta,deps={}){const js=ts.transpileModule(readFileSync(new URL(ruta,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new Function('require','exports',js)(id=>deps[id]??require(id),exports);return exports}
const modelo=cargar('../lib/medico/modelo.ts')
const borradores=cargar('../lib/medico/borrador.ts')

test('la recuperación separa cuenta y cita, conserva medicamentos incompletos e ignora campos calculados del servidor',()=>{
 const datos={...modelo.CONTENIDO_VACIO,medicamentos:[{nombre:'Medicamento de prueba',dosis:'',via:'',frecuencia:'',duracion:''}]}
 assert.equal(borradores.medicamentosCompletos(datos),false)
 assert.equal(borradores.firmaContenidoConsulta(datos),borradores.firmaContenidoConsulta({...datos,signos:{pulso:70}}))
 const clave=borradores.claveBorradorConsulta('medico-uno',35),map=new Map(),storage={getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k)}
 map.set(clave,JSON.stringify({version:'a'.repeat(32),contenido:datos,actualizado:100000}))
 assert.deepEqual(borradores.leerBorradorConsulta(clave,storage,100000).contenido,datos)
 assert.equal(borradores.leerBorradorConsulta(borradores.claveBorradorConsulta('medico-dos',35),storage,100000),null)
 assert.equal(borradores.leerBorradorConsulta(borradores.claveBorradorConsulta('medico-uno',36),storage,100000),null)
 assert.equal(borradores.leerBorradorConsulta(clave,storage,100000+24*3600000+1),null);assert.equal(map.size,0)
 for(const contenido of [{...datos,medicamentos:[null]},{...datos,plan:'a'.repeat(8001)}]){map.set(clave,JSON.stringify({version:'a'.repeat(32),contenido,actualizado:100000}));assert.equal(borradores.leerBorradorConsulta(clave,storage,100000),null)}
})

test('el medicamento completo exige vía y demás indicaciones; el almacenamiento bloqueado se comunica sin romper la consulta',()=>{
 const datos={...modelo.CONTENIDO_VACIO,medicamentos:[{nombre:'Medicamento',dosis:'Dosis indicada',via:'Vía indicada',frecuencia:'Frecuencia indicada',duracion:'Duración indicada'}]}
 assert.equal(borradores.medicamentosCompletos(datos),true)
 assert.equal(borradores.medicamentosCompletos({...datos,medicamentos:[{...datos.medicamentos[0],via:'a'.repeat(121)}]}),false)
 const previo=globalThis.window
 try{globalThis.window={sessionStorage:{setItem:()=>{throw Error('cuota')}}};assert.equal(borradores.protegerBorradorConsulta('propio','a'.repeat(32),datos),false)}finally{if(previo===undefined)delete globalThis.window;else globalThis.window=previo}
})
test('lectura de notas previas conserva texto y no inventa dosis ni exploración',()=>{
 const r=modelo.contenidoInicial({contenido:{},diagnostico:'Diagnóstico previo',receta:'Texto previo',notas_doctor:'Nota previa'})
 assert.equal(r.recetaLibre,'Texto previo');assert.equal(r.objetivo,'');assert.equal(r.plan,'');assert.deepEqual(r.medicamentos,[])
})
test('la receta se emite desde una nota cerrada, conserva aclaraciones y escapa contenido',()=>{
 const c={cita:{id:1,paciente:'<script>ejemplo</script>',medico:'Médico',cedula:'CED-1',inicio:'2026-11-12T18:00:00Z'},nota:{estado_nota:'borrador',contenido:{}},correcciones:[]}
 assert.throws(()=>modelo.recetaHTML(c),/Finaliza/)
 c.nota={estado_nota:'cerrada',contenido:{medicamentos:[{nombre:'Indicación',dosis:'Dosis prescrita',via:'Vía registrada',frecuencia:'Frecuencia indicada',duracion:'Duración registrada'}]}}
 c.correcciones=[{texto:'Aclaración del médico',autor:'Responsable',fecha:'2026-11-12'}]
 const html=modelo.recetaHTML(c);assert.ok(html.includes('&lt;script&gt;ejemplo'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Aclaración del médico'));assert.ok(html.includes('Frecuencia indicada'))
})
test('API médica exige sesión, rol, versión y operaciones cerradas sin aceptar identidad externa',async()=>{
 let acceso={respuesta:Response.json({},{status:423})},origen=true,llamadas=[]
 const api=cargar('../app/api/medico/route.ts',{'@/lib/cuenta/servidor':{cuentaAutenticada:async()=>acceso,origenValido:()=>origen},'@/lib/supabase/error-operacion':cargar('../lib/supabase/error-operacion.ts')})
 const b={accion:'guardar',datos:{citaId:1,version:'a'.repeat(32),contenido:{}},clave:'11111111-1111-4111-8111-111111111111'}
 const enviar=v=>api.POST(new Request('http://localhost/api/medico',{method:'POST',body:JSON.stringify(v)}))
 assert.equal((await enviar(b)).status,423)
 acceso={usuario:{rol:'recepcionista'}};assert.equal((await enviar(b)).status,403)
 acceso={usuario:{rol:'medico'},db:{rpc:async(nombre,datos)=>{llamadas.push({nombre,datos});return {data:{ok:true}}}}}
 origen=false;assert.equal((await enviar(b)).status,403);origen=true
 for(const v of [{...b,accion:'borrar'},{...b,datos:{version:'caducada'}},{...b,clave:'inventada'},{...b,datos:[]}])assert.equal((await enviar(v)).status,400)
 assert.equal(llamadas.length,0)
 assert.equal((await enviar({...b,autor:999})).status,200);assert.equal(llamadas[0].nombre,'clinica_medico_operar');assert.ok(!('autor' in llamadas[0].datos))
 assert.equal((await api.GET(new Request('http://localhost/api/medico?dia=2026-02-30'))).status,400)
})
test('el endpoint anterior no sobrescribe una nota existente sin su versión',async()=>{
 const llamadas=[]
 const db={rpc:async(nombre,datos)=>{llamadas.push(nombre);return {data:nombre==='clinica_consulta_leer'?{version:'a'.repeat(32),nota:{id:1}}:{id:1}}}}
 const api=cargar('../app/api/expedientes/route.ts',{'@/lib/cuenta/servidor':{cuentaAutenticada:async()=>({usuario:{rol:'medico'},db}),origenValido:()=>true},'@/lib/supabase/error-operacion':cargar('../lib/supabase/error-operacion.ts')})
 const r=await api.POST(new Request('http://localhost/api/expedientes',{method:'POST',body:JSON.stringify({citaId:1,diagnostico:'Cambiar'})}))
 assert.equal(r.status,409);assert.deepEqual(llamadas,['clinica_consulta_leer']);assert.equal((await api.DELETE()).status,403)
})
