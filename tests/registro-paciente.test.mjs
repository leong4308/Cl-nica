import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function cargar(ruta,deps={}){const js=ts.transpileModule(readFileSync(new URL(ruta,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};new Function('require','exports',js)(id=>deps[id]??require(id),exports);return exports}
const modelo=cargar('../lib/cuenta/registro.ts',{'@/lib/agenda/modelo':cargar('../lib/agenda/modelo.ts'),'./recuperacion':cargar('../lib/cuenta/recuperacion.ts'),'./validacion':cargar('../lib/cuenta/validacion.ts')})
const datos={nombre:'Paciente de prueba',telefono:'9611234567',fechaNacimiento:'1992-05-14',genero:'F',contactoEmergencia:'Contacto de prueba',telefonoEmergencia:'9617654321',correo:'paciente@example.test',nueva:'MiCuentaSegura123',confirmacion:'MiCuentaSegura123'}
function preparar(){let origen=true,disponible=true,error=null,session=null,user={id:'nuevo'},llamadas=[]
 const api=cargar('../app/api/auth/registro/route.ts',{'@/lib/cuenta/servidor':{origenValido:()=>origen},'@/lib/cuenta/registro':modelo,'@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:disponible}),auth:{signUp:async d=>{llamadas.push(d);return{data:{user,session},error}}}})}})
 return {api,llamadas,origen:v=>origen=v,disponible:v=>disponible=v,error:v=>error=v,session:v=>session=v,user:v=>user=v,post:d=>api.POST(new Request('https://clinica.example.test/api/auth/registro',{method:'POST',body:JSON.stringify(d)}))}
}
test('valida todos los campos personales y de acceso sin aceptar permisos enviados por el usuario',()=>{
 const r=modelo.validarRegistroPaciente({...datos,nombre:'  Paciente de prueba  ',correo:' PACIENTE@EXAMPLE.TEST ',rol:'admin',puede_validar_laboratorio:true})
 assert.equal(r.correo,datos.correo);assert.equal(r.personales.nombre,datos.nombre);assert.ok(!('rol' in r));assert.ok(!('rol' in r.personales))
 for(const campo of Object.keys(datos)){const d={...datos};delete d[campo];assert.throws(()=>modelo.validarRegistroPaciente(d))}
 for(const cambio of [{fechaNacimiento:'2100-01-01'},{fechaNacimiento:'2026-02-30'},{genero:'admin'},{telefono:'123'},{telefonoEmergencia:'1234567890123456'},{correo:'invalido'},{nueva:'clave'},{confirmacion:'OtraClaveSegura123'}])assert.throws(()=>modelo.validarRegistroPaciente({...datos,...cambio}))
})
test('la API rechaza origen, JSON y tamaño inválidos antes de intentar registrar',async()=>{
 const p=preparar();p.origen(false);assert.equal((await p.post(datos)).status,403);p.origen(true)
 assert.equal((await p.api.POST(new Request('https://example.test',{method:'POST',body:'no-json'}))).status,400)
 assert.equal((await p.post({...datos,extra:'a'.repeat(4500)})).status,413);assert.equal(p.llamadas.length,0)
})
test('el registro requiere la migración y nunca simula una cuenta guardada',async()=>{
 const p=preparar();p.disponible(false);assert.equal((await p.post(datos)).status,503);assert.equal(p.llamadas.length,0)
 p.disponible(true);p.user(null);assert.equal((await p.post(datos)).status,503)
})
test('Auth recibe únicamente el perfil validado, sin rol ni identificadores, y no expone sesión o contraseña',async()=>{
 const p=preparar(),r=await p.post({...datos,rol:'admin',medicoId:1,usuarioId:1,puede_validar_laboratorio:true})
 assert.equal(r.status,200);const b=await r.json();assert.deepEqual(b,{ok:true,requiereConfirmacion:true})
 const d=p.llamadas[0];assert.equal(d.email,datos.correo);assert.equal(d.password,datos.nueva)
 assert.deepEqual(d.options.data,{nombre_completo:datos.nombre,cn_registro_paciente:modelo.datosPersonalesRegistro(datos)})
 assert.equal(d.options.emailRedirectTo,'https://clinica.example.test/auth/callback')
 assert.ok(!JSON.stringify(b).includes(datos.nueva));assert.ok(!JSON.stringify(b).includes('nuevo'))
 p.session({access_token:'privado'});assert.equal((await(await p.post(datos)).json()).requiereConfirmacion,false)
})
test('los errores de Auth se presentan sin secretos y el límite de correo no se confunde con registro exitoso',async()=>{
 const p=preparar()
 for(const [error,status] of [[{code:'over_email_send_rate_limit',status:429},429],[{code:'signup_disabled'},503],[{code:'email_address_not_authorized'},503],[{code:'unexpected_failure',message:'Error sending confirmation email'},503],[{code:'weak_password'},400],[{code:'unexpected_failure',message:'error secreto interno'},400]]){
  p.error(error);const r=await p.post(datos);assert.equal(r.status,status);assert.ok(!JSON.stringify(await r.json()).includes('secreto'))
 }
})
