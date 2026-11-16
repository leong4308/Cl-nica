import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
import {configuracionCorreo,correoInvitacion,correoCita,enviarCorreo,entregarCorreos} from '../lib/notificaciones/correo.mjs'
const require=createRequire(import.meta.url)
function cargar(ruta,deps={}){const js=ts.transpileModule(readFileSync(new URL(ruta,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new Function('require','exports',js)(id=>deps[id]??require(id),exports);return exports}
const config={clave:'privada-prueba',remitente:'Clínica <avisos@example.test>',appUrl:'https://clinica.example.test'}
const envio={id:5,correo:'paciente@example.test',tipo:'recordatorio_30m',titulo:'Recordatorio',cita:{id:35,paciente:'Paciente <script>malo</script>',medico:'Dra. Ejemplo',clinica:'Clínica Nova',direccion:'Sede de prueba',estado:'confirmada',inicio:'2026-11-13T18:00:00Z',fin:'2026-11-13T18:20:00Z'}}
test('configuración privada válida y URL pública o localhost explícita',()=>{
 assert.equal(configuracionCorreo({}),null)
 const e={RESEND_API_KEY:'privada',EMAIL_FROM:config.remitente,APP_URL:config.appUrl}
 assert.ok(configuracionCorreo(e));assert.ok(configuracionCorreo({...e,APP_URL:'http://localhost:3000'}))
 for(const APP_URL of ['javascript:alert(1)','http://clinica.example.test','https://usuario:clave@example.test','https://example.test?token=secreto'])assert.equal(configuracionCorreo({...e,APP_URL}),null)
})
test('plantillas legibles con zona clínica, texto alternativo y escape de contenido',()=>{
 const c=correoCita(envio,config.appUrl)
 assert.ok(c.html.includes('Clínica Nova'));assert.ok(c.text.includes('12:00'));assert.ok(c.text.includes('Ciudad de México'))
 assert.ok(!c.html.includes('<script>'));assert.ok(c.html.includes('&lt;script&gt;'))
 const i=correoInvitacion('Paciente <b>','https://example.test/activar-cuenta#secreto')
 assert.ok(i.html.includes('24 horas'));assert.ok(i.html.includes('Activar mi cuenta'));assert.ok(!i.html.includes('Paciente <b>'))
})
test('proveedor usa clave de idempotencia y no expone credenciales ni errores del proveedor',async()=>{
 let opciones
 assert.equal(await enviarCorreo(config,envio.correo,correoCita(envio,config.appUrl),'aviso-5',async(_,op)=>{opciones=op;return Response.json({id:'correo-5'})}),'correo-5')
 assert.equal(opciones.headers['Idempotency-Key'],'aviso-5');assert.ok(!JSON.parse(opciones.body).html.includes(config.clave))
 await assert.rejects(enviarCorreo(config,envio.correo,{},'5',async()=>Response.json({error:'privada-prueba'}, {status:403})),e=>e.codigo==='HTTP_403'&&e.permanente===true&&!e.message.includes('privada-prueba'))
})
test('trabajador vuelve a verificar vigencia y reintenta con la misma clave',async()=>{
 let vigente=null,llamadas=[],peticiones=[]
 const db={correo:async(op,d)=>{llamadas.push({op,d});return op==='reclamar'?[{id:5,arrendamiento:'reserva'}]:op==='vigente'?vigente:{ok:true}}}
 const fetcher=async(_,op)=>{peticiones.push(op);return Response.json({id:'aceptado'})}
 assert.equal(await entregarCorreos(db,config,fetcher),0);assert.equal(peticiones.length,0);assert.equal(llamadas.at(-1).op,'omitir')
 vigente=envio;assert.equal(await entregarCorreos(db,config,fetcher),1);assert.equal(llamadas.at(-1).op,'enviado');assert.equal(peticiones[0].headers['Idempotency-Key'],'clinica-cita-5')
 assert.equal(await entregarCorreos(db,null,fetcher),0)
})
test('invitar exige recepción o administración, sesión y confirmación de correo; no devuelve secretos',async()=>{
 let acceso={respuesta:Response.json({}, {status:423})},origen=true,configurado=true,enviados=0,llamadas=[]
 const db={rpc:async(nombre,p)=>{llamadas.push({nombre,p});return {data:{id:'inv',token:'secreto',correo:'paciente@example.test',nombre:'Paciente'}}},from:()=>({update:()=>({eq:async()=>({})})})}
 const api=cargar('../app/api/pacientes/[id]/portal/route.ts',{'@/lib/cuenta/servidor':{cuentaAutenticada:async()=>acceso,origenValido:()=>origen},'@/lib/supabase/admin-servidor':{clienteAdmin:()=>db},'@/lib/supabase/error-operacion':cargar('../lib/supabase/error-operacion.ts'),'@/lib/notificaciones/correo.mjs':{configuracionCorreo:()=>configurado?config:null,correoInvitacion,enviarCorreo:async()=>{enviados++}}})
 const ctx={params:Promise.resolve({id:'2'})},enviar=b=>api.POST(new Request('https://example.test/api/pacientes/2/portal',{method:'POST',body:JSON.stringify(b)}),ctx)
 assert.equal((await enviar({confirmarCorreo:true})).status,423)
 for(const rol of ['medico','enfermero','paciente']){acceso={usuario:{rol}};assert.equal((await enviar({confirmarCorreo:true})).status,403)}
 acceso={usuario:{rol:'recepcionista'},user:{id:'actor-real'}};assert.equal((await enviar({})).status,400)
 configurado=false;assert.equal((await enviar({confirmarCorreo:true})).status,503);configurado=true
 origen=false;assert.equal((await enviar({confirmarCorreo:true})).status,403);origen=true
 const r=await enviar({confirmarCorreo:true,actor:'intruso'});assert.equal(r.status,200);assert.ok(!(await r.text()).includes('secreto'));assert.equal(llamadas[0].p.p_actor,'actor-real');assert.equal(enviados,1)
})
test('activar valida el enlace y la contraseña antes de crear la cuenta; no permite reasignar identidad',async()=>{
 let creada=0,cuerpo,estado={correo:'destino@example.test',nombre:'Paciente',activada:false}
 const db={rpc:async()=>({data:estado}),auth:{admin:{createUser:async b=>{creada++;cuerpo=b;return {data:{user:{id:'nuevo'}}}}}}}
 const api=cargar('../app/api/portal/activacion/route.ts',{'@/lib/cuenta/servidor':{origenValido:()=>true},'@/lib/supabase/admin-servidor':{clienteAdmin:()=>db},'@/lib/cuenta/recuperacion':cargar('../lib/cuenta/recuperacion.ts')})
 const enviar=b=>api.POST(new Request('https://example.test/api/portal/activacion',{method:'POST',body:JSON.stringify(b)}))
 assert.equal((await enviar({accion:'activar',token:'invalido'})).status,400)
 const base={accion:'activar',token:'a'.repeat(64),nueva:'PacienteSeguro123',confirmacion:'PacienteSeguro123',correo:'intruso@example.test',rol:'admin'}
 assert.equal((await enviar({...base,nueva:'corta'})).status,400);assert.equal(creada,0)
 assert.equal((await enviar(base)).status,200);assert.equal(cuerpo.email,'destino@example.test');assert.deepEqual(cuerpo.user_metadata,{cn_invitacion:base.token});assert.equal(cuerpo.email_confirm,true)
 estado={activada:true};assert.equal((await enviar(base)).status,200);assert.equal(creada,1)
})
