import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function cargar(ruta,deps={}){const js=ts.transpileModule(readFileSync(new URL(ruta,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const exports={};new Function('require','exports',js)(id=>id==='@/lib/supabase/error-operacion'?cargar('../lib/supabase/error-operacion.ts'):deps[id]??require(id),exports);return exports}
const body={nombre:'Paciente',correo:'nuevo@example.test',correoAnterior:'actual@example.test',telefono:'5551234567',fechaNacimiento:'',genero:'',contactoEmergencia:'',telefonoEmergencia:''}
function escenario(rol='admin',vinculado=false){
 let bloqueada=false,fallarCorreo=false,configurado=true,envios=0;const llamadas=[]
 const perfil={id:7,usuario_id:70,usuarios:{nombre_completo:'Paciente',correo:'actual@example.test',telefono:'5551234567'}}
 const db={auth:{getUser:async()=>({data:{user:{id:'actor-real'}}})},rpc:async(nombre,p)=>{llamadas.push({nombre,p});return {data:nombre==='clinica_directorio_recepcion'?[perfil]:nombre==='clinica_estado_sesion'?{bloqueada}:{ok:true}}},from(tabla){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:tabla==='usuarios'?{id:1,rol,esta_activo:true}:perfil})};return q}}
 const admin={rpc:async(nombre,p)=>{llamadas.push({nombre,p});return {data:nombre==='clinica_estado_correo_paciente'?{vinculado}:{id:'cambio',token:'secreto',correo:'nuevo@example.test',nombre:'Paciente'}}},from:()=>({update:()=>({eq:async()=>({})})})}
 const api=cargar('../app/api/pacientes/[id]/route.ts',{'@/lib/pacientes/acceso':{autorizarRegistro:async()=>null},'@/lib/supabase/server':{createClient:async()=>db},'@supabase/supabase-js':{createClient:()=>admin},'@/lib/cuenta/validacion':cargar('../lib/cuenta/validacion.ts'),'@/lib/notificaciones/correo.mjs':{configuracionCorreo:()=>configurado?{appUrl:'https://example.test'}:null,correoCambioAcceso:()=>({}),enviarCorreo:async()=>{envios++;if(fallarCorreo)throw {codigo:'HTTP_403'}}}})
 const ctx={params:Promise.resolve({id:'7'})}
 return {api,ctx,llamadas,enviar:(b=body)=>api.PATCH(new Request('http://localhost/api/pacientes/7',{method:'PATCH',body:JSON.stringify(b)}),ctx),bloquear:()=>{bloqueada=true},fallar:()=>{fallarCorreo=true},sinConfig:()=>{configurado=false},envios:()=>envios}
}
for(const rol of ['admin','recepcionista'])test(`${rol}: el correo es editable y se guarda en la ficha sin cuenta`,async()=>{
 const e=escenario(rol),get=await e.api.GET(new Request('http://localhost'),e.ctx)
 assert.equal((await get.json()).puedeEditarCorreo,true)
 const r=await e.enviar();assert.equal(r.status,200);assert.equal((await r.json()).correoActual,'nuevo@example.test')
 assert.ok(e.llamadas.some(l=>l.nombre==='clinica_actualizar_paciente'&&l.p.p_datos.correo==='nuevo@example.test'));assert.equal(e.envios(),0)
})
test('médicos no cambian correo, las sesiones bloqueadas no guardan y una versión anterior no se sobreescribe',async()=>{
 const m=escenario('medico');assert.equal((await m.enviar()).status,403)
 const a=escenario();a.bloquear();assert.equal((await a.enviar()).status,423)
 const b=escenario();assert.equal((await b.enviar({...body,correoAnterior:'viejo@example.test'})).status,409)
 assert.equal(b.llamadas.filter(l=>l.nombre==='clinica_actualizar_paciente').length,0)
})
test('una cuenta vinculada recibe confirmación sin cambiar su acceso ni devolver secretos',async()=>{
 const e=escenario('recepcionista',true),r=await e.enviar(),b=await r.json()
 assert.equal(r.status,200);assert.equal(b.correoActual,'actual@example.test');assert.equal(b.correoPendiente,'nuevo@example.test');assert.ok(!JSON.stringify(b).includes('secreto'))
 assert.equal(e.envios(),1)
 const contacto=e.llamadas.find(l=>l.nombre==='clinica_actualizar_paciente');assert.equal(contacto.p.p_datos.correo,undefined)
 const peticion=e.llamadas.find(l=>l.nombre==='clinica_cambio_correo_preparar');assert.equal(peticion.p.p_actor,'actor-real')
})
test('fallo de correo conserva el acceso y explica que los contactos sí se guardaron',async()=>{
 const e=escenario('admin',true);e.fallar();const b=await (await e.enviar()).json()
 assert.equal(b.correoActual,'actual@example.test');assert.ok(b.errorCorreo);assert.ok(b.mensaje.includes('guardaron los datos personales'))
 const sin=escenario('admin',true);sin.sinConfig();assert.equal((await sin.enviar()).status,503);assert.ok(!sin.llamadas.some(l=>l.nombre==='clinica_actualizar_paciente'))
})
test('la confirmación deriva usuario y dirección del token y conserva la contraseña',async()=>{
 let atributos;const db={rpc:async()=>({data:{correo:'nuevo@example.test',authId:'cuenta-real'}}),auth:{admin:{updateUserById:async(id,a)=>{atributos={id,a};return {data:{}}}}}}
 const api=cargar('../app/api/portal/correo/route.ts',{'@/lib/cuenta/servidor':{origenValido:()=>true},'@/lib/supabase/admin-servidor':{clienteAdmin:()=>db}})
 const r=await api.POST(new Request('https://example.test/api/portal/correo',{method:'POST',body:JSON.stringify({accion:'confirmar',token:'a'.repeat(64),authId:'otra',correo:'intruso@example.test'})}))
 assert.equal(r.status,200);assert.equal(atributos.id,'cuenta-real');assert.equal(atributos.a.email,'nuevo@example.test');assert.equal(atributos.a.password,undefined)
})
test('el formulario de registro incluye correo opcional normalizado',()=>{
 const {payloadPaciente,DATOS_PACIENTE_INICIALES}=cargar('../components/modulos/compartidos/campos-paciente.tsx')
 assert.equal(payloadPaciente({...DATOS_PACIENTE_INICIALES,nombre:'Paciente',correo:'  PACIENTE@example.test '}).correo,'paciente@example.test')
 assert.equal(payloadPaciente(DATOS_PACIENTE_INICIALES).correo,undefined)
})
