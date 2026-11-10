import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function cargar(ruta,deps={}){const js=ts.transpileModule(readFileSync(new URL(ruta,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};new Function('require','exports',js)(id=>deps[id]??require(id),exports);return exports}
const recuperacion=cargar('../lib/cuenta/recuperacion.ts')
test('la recuperación rechaza destinos externos, claves débiles y confirmaciones distintas',()=>{
 for(const url of ['https://ejemplo.test','//ejemplo.test','/\\ejemplo.test','/\r\nejemplo'])assert.equal(recuperacion.destinoSeguro(url),'/')
 assert.equal(recuperacion.destinoSeguro('/restablecer-contrasena'),'/restablecer-contrasena')
 assert.ok(recuperacion.validarNuevaContrasena('123','123'));assert.ok(recuperacion.validarNuevaContrasena('ClaveSegura123*','OtraClave123*'))
 assert.equal(recuperacion.validarNuevaContrasena('ClaveSegura123*','ClaveSegura123*'),null)
})
test('el servidor impide cambiar contraseña sin la sesión del enlace de recuperación',async()=>{
 let cambios=0,cookie='otro-usuario'
 const api=cargar('../app/api/auth/restablecer/route.ts',{
  '@/lib/cuenta/recuperacion':recuperacion,'@/lib/cuenta/servidor':{origenValido:()=>true},
  'next/headers':{cookies:async()=>({get:()=>({value:cookie}),delete(){}})},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'usuario'}},error:null}),updateUser:async()=>{cambios++;return{error:null}},signOut:async()=>({error:null})}})},
 })
 const request=()=>new Request('http://localhost/api/auth/restablecer',{method:'POST',body:JSON.stringify({nueva:'ClaveSegura123*',confirmacion:'ClaveSegura123*'})})
 assert.equal((await api.POST(request())).status,401);assert.equal(cambios,0)
 cookie='usuario';assert.equal((await api.POST(request())).status,200);assert.equal(cambios,1)
})
test('acceso a documentos verifica el paciente asociado y no acepta un vínculo de otro médico',async()=>{
 const acceso=cargar('../lib/pacientes/acceso.ts',{'./listado':{}})
 const db={from(){const q={select(){return q},eq(){return q},async maybeSingle(){return{data:{citas:{paciente_id:7}},error:null}}};return q},rpc:async()=>({data:false,error:null})}
 assert.equal((await acceso.autorizarRegistro(db,'expedientes',5,{id:2,rol:'medico'})).status,403)
 db.rpc=async(nombre,params)=>{assert.equal(nombre,'clinica_paciente');assert.deepEqual(params,{p_id:7});return{data:true,error:null}}
 assert.equal(await acceso.autorizarRegistro(db,'expedientes',5,{id:2,rol:'medico'}),null)
})
test('los errores de transacción se comunican sin mostrar consultas ni datos internos',async()=>{
 const e=cargar('../lib/supabase/error-operacion.ts')
 assert.equal(e.errorOperacion({code:'23P01',message:'El intervalo se ocupó'}).status,409)
 assert.equal(e.errorOperacion({code:'42501',message:'Sin acceso'}).status,403)
 assert.equal(e.errorOperacion({code:'PGRST202'}).status,503)
 const original=console.error;console.error=()=>{}
 try{assert.ok(!(await e.errorOperacion({code:'XX000',message:'dato-clinico-privado'}).text()).includes('dato-clinico-privado'))}finally{console.error=original}
})
test('una cuenta administrativa desactivada no puede gestionar usuarios con una sesión todavía válida',async()=>{
 const db={auth:{getUser:async()=>({data:{user:{id:'administrador'}}})},from(){const q={select(){return q},eq(){return q},async maybeSingle(){return {data:{rol:'admin',esta_activo:false},error:null}}};return q}}
 const api=cargar('../app/api/admin/users/route.ts',{'@/lib/cuenta/servidor':{origenValido:()=>true},'@/lib/supabase/server':{createClient:async()=>db},'@supabase/supabase-js':{createClient:()=>db}})
 assert.equal((await api.GET()).status,403)
 assert.equal((await api.PATCH(new Request('http://localhost/api/admin/users',{method:'PATCH',body:'{}'}))).status,403)
})
