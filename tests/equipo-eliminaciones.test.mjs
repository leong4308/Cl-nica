import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function cargar(ruta,deps={}){const js=ts.transpileModule(readFileSync(new URL(ruta,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};new Function('require','exports',js)(id=>deps[id]??(id==='@/lib/supabase/error-operacion'?cargar('../lib/supabase/error-operacion.ts'):require(id)),exports);return exports}
const retirada=cargar('../lib/documentos-retirada.ts')
const uuid='11111111-1111-4111-8111-111111111111'
function entorno(ruta){let rol='admin',bloqueada=false,origen=true,llamadas=[]
 const db={rpc:async(fn,params)=>{llamadas.push({fn,params});return{data:{ok:true,id:uuid},error:null}}}
 const servidor={cuentaAutenticada:async()=>bloqueada?{respuesta:Response.json({},{status:423})}:{usuario:{id:1,rol},db},origenValido:()=>origen}
 const api=cargar(ruta,{'@/lib/cuenta/servidor':servidor})
 return{api,llamadas,rol:v=>rol=v,bloqueada:v=>bloqueada=v,origen:v=>origen=v}
}
const req=(metodo,body)=>new Request('http://localhost/api/prueba',{method:metodo,...(body===undefined?{}:{body:JSON.stringify(body)})})

test('el ingreso urgente comprueba rol, origen, confirmación y datos; no acepta identidad ni diagnóstico suministrados',async()=>{
 const e=entorno('../app/api/enfermeria/ingresos/route.ts'),request=()=>new Request('http://localhost/api/enfermeria/ingresos?buscar=Paciente')
 assert.equal((await e.api.GET(request())).status,403)
 e.rol('enfermero');e.bloqueada(true);assert.equal((await e.api.GET(request())).status,423);e.bloqueada(false)
 assert.equal((await e.api.GET(request())).status,200);assert.equal(e.llamadas[0].fn,'clinica_enfermeria_ingresos_panel')
 const datos={pacienteId:1,medicoId:2,camaId:3,motivo:'Observación',observaciones:'Recibido para valoración',confirmado:true}
 e.origen(false);assert.equal((await e.api.POST(req('POST',{clave:uuid,datos}))).status,403);e.origen(true)
 assert.equal((await e.api.POST(req('POST',{clave:uuid,datos:{...datos,confirmado:false}}))).status,400)
 assert.equal((await e.api.POST(req('POST',{clave:uuid,datos:{...datos,camaId:-1}}))).status,400)
 assert.equal((await e.api.POST(req('POST',{clave:uuid,datos:{...datos,autor:999,diagnostico:'No autorizado'}}))).status,200)
 assert.deepEqual(e.llamadas.at(-1),{fn:'clinica_enfermeria_ingreso_registrar',params:{p_datos:datos,p_clave:uuid}})
})

test('Resumen desaparece de administración y las preferencias anteriores vuelven a Citas',()=>{
 const nav=cargar('../components/modulos/barra-lateral/navegacion/items-menu.ts'),pref=cargar('../lib/cuenta/preferencias.ts')
 assert.equal(nav.obtenerNavItemsPorRol('admin').some(i=>i.label==='Resumen'),false)
 assert.equal(nav.obtenerItemDefaultPorRol('admin'),'Citas');assert.equal(pref.normalizarPreferencias({paginaInicio:'Resumen'},'admin').paginaInicio,'Predeterminada')
 for(const rol of ['admin','medico','recepcionista'])assert.ok(pref.opcionesInicio(rol).includes('Equipo'))
 assert.ok(!pref.opcionesInicio('paciente').includes('Equipo'));assert.ok(!pref.opcionesInicio('enfermero').includes('Equipo'))
 const menu=cargar('../components/roles/enfermero/barra-lateral/navegacion/items-menu.ts');assert.deepEqual(menu.navItemsEnfermero.map(i=>i[0]),['Resumen','Pacientes','Citas','Internación','Órdenes médicas','Laboratorio'])
})

test('API del equipo verifica sesión, origen, rol y tamaño; la identidad nunca proviene del navegador',async()=>{
 const e=entorno('../app/api/equipo/route.ts');e.bloqueada(true);assert.equal((await e.api.GET()).status,423);e.bloqueada(false)
 e.rol('paciente');assert.equal((await e.api.GET()).status,403);e.rol('enfermero');e.origen(false)
 const body={accion:'enviar',datos:{destinatario:2,ambito:'administrativo',asunto:'Coordinar ingreso',contenido:'Solicito apoyo con la recepción.'},clave:uuid}
 assert.equal((await e.api.POST(req('POST',body))).status,403);e.origen(true)
 assert.equal((await e.api.POST(req('POST',{...body,datos:[]}))).status,400)
 assert.equal((await e.api.POST(req('POST',{...body,datos:{contenido:'a'.repeat(6100)}}))).status,413)
 assert.equal(e.llamadas.length,0)
 assert.equal((await e.api.POST(req('POST',{...body,usuarioId:999,rol:'admin'}))).status,200)
 assert.deepEqual(e.llamadas[0],{fn:'clinica_equipo_operar',params:{p_accion:'enviar',p_datos:body.datos,p_clave:uuid}})
})

test('eliminar exige administrador, confirmación, motivo, versión y módulo correcto',async()=>{
 const e=entorno('../app/api/admin/eliminaciones/route.ts')
 const body={modulo:'Pacientes',id:17,version:'a'.repeat(32),motivo:'Registro duplicado de prueba',confirmado:true}
 for(const rol of ['medico','enfermero','recepcionista','paciente']){e.rol(rol);assert.equal((await e.api.DELETE(req('DELETE',body))).status,403)}
 e.rol('admin');e.bloqueada(true);assert.equal((await e.api.DELETE(req('DELETE',body))).status,423);e.bloqueada(false)
 for(const cambio of [{confirmado:false},{version:'vieja'},{motivo:'corto'},{modulo:'usuarios; drop table citas'},{id:-1}])assert.equal((await e.api.DELETE(req('DELETE',{...body,...cambio}))).status,400)
 assert.equal(e.llamadas.length,0);assert.equal((await e.api.DELETE(req('DELETE',body))).status,200)
 assert.deepEqual(e.llamadas[0],{fn:'clinica_admin_eliminar',params:{p_modulo:'Pacientes',p_id:17,p_version:body.version,p_motivo:body.motivo,p_confirmar:true}})
})

test('la retirada del PDF conserva una copia privada y revierte el movimiento si falla el registro',async()=>{
 const movimientos=[],storage={from:bucket=>({move:async(origen,destino)=>{movimientos.push({bucket,origen,destino});return{error:null}}})}
 assert.deepEqual(await retirada.retirarPdfConCopia(storage,'documentos-clinicos','expedientes/7/informe.pdf',async()=>({error:null})),{ok:true})
 assert.match(movimientos[0].destino,/^retirados\/[a-f0-9-]+\/expedientes\/7\/informe.pdf$/)
 movimientos.length=0
 const r=await retirada.retirarPdfConCopia(storage,'documentos-clinicos','expedientes/7/informe.pdf',async()=>({error:{code:'40001'}}))
 assert.equal(r.ok,false);assert.equal(r.status,409);assert.equal(movimientos.length,2)
 assert.equal(movimientos[1].origen,movimientos[0].destino);assert.equal(movimientos[1].destino,'expedientes/7/informe.pdf')
})

test('un PDF que ya no existe no registra una eliminación exitosa',async()=>{
 let registros=0
 const r=await retirada.retirarPdfConCopia({from:()=>({move:async()=>({error:{code:'404'}})})},'documentos-clinicos','expedientes/7/informe.pdf',async()=>{registros++;return{error:null}})
 assert.equal(r.ok,false);assert.equal(r.status,409);assert.equal(registros,0)
})

function documento(tipo,rol='admin'){
 const movimientos=[],auditorias=[];let bloqueada=false,fallar=false
 const archivo='12345678-informe.pdf',version='2026-11-17T12:00:00Z'
 const db={auth:{getUser:async()=>({data:{user:{id:'auth-admin'}}})},from:tabla=>{const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:tabla==='usuarios'?{id:1,rol,esta_activo:true}:{id:7,archivo_resultado:'7/'+archivo,fecha_resultado:version},error:null})};return q},rpc:async(fn,params)=>{auditorias.push({fn,params});return{error:fallar?{code:'40001'}:null,data:{ok:true}}}}
 const storage={from:bucket=>({list:async()=>({data:[{name:archivo}],error:null}),move:async(origen,destino)=>{movimientos.push({bucket,origen,destino});return{error:null}}})}
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='solo-prueba'
 const deps={'@/lib/cuenta/servidor':{origenValido:()=>true,cuentaAutenticada:async()=>bloqueada?{respuesta:Response.json({},{status:423})}:{usuario:{rol},db}},'@/lib/documentos-retirada':retirada,'@/lib/supabase/server':{createClient:async()=>db},'@/lib/pacientes/acceso':{autorizarRegistro:async()=>null},'@supabase/supabase-js':{createClient:()=>({storage})},'@/lib/laboratorio/archivo-pdf':cargar('../lib/laboratorio/archivo-pdf.ts')}
 deps['@/lib/documentos-clinicos']=cargar('../lib/documentos-clinicos.ts',{'./laboratorio/archivo-pdf':deps['@/lib/laboratorio/archivo-pdf']})
 const laboratorio=tipo==='laboratorio',api=cargar(laboratorio?'../app/api/laboratorio/[id]/route.ts':'../app/api/documentos-clinicos/[tipo]/[id]/route.ts',deps)
 const contexto={params:Promise.resolve({tipo,id:'7'})},body={archivo,version,motivo:'Documento duplicado de prueba',confirmado:true}
 return{movimientos,auditorias,api,contexto,body,bloquear:()=>bloqueada=true,fallar:()=>fallar=true,enviar:b=>api.DELETE(req('DELETE',b??body),contexto)}
}

for(const tipo of ['expedientes','laboratorio'])test(`${tipo}: retirar PDF verifica rol, bloqueo, nombre, versión y registra solo el documento seleccionado`,async()=>{
 for(const rol of ['medico','enfermero','recepcionista','paciente']){const e=documento(tipo,rol);assert.equal((await e.enviar()).status,403);assert.equal(e.movimientos.length,0)}
 const b=documento(tipo);b.bloquear();assert.equal((await b.enviar()).status,423);assert.equal(b.movimientos.length,0)
 const e=documento(tipo)
 for(const cambio of [{confirmado:false},{archivo:'../otro.pdf'},{motivo:'corto'}])assert.equal((await e.enviar({...e.body,...cambio})).status,400)
 if(tipo==='laboratorio')assert.equal((await e.enviar({...e.body,version:'anterior'})).status,409)
 assert.equal(e.movimientos.length,0);assert.equal((await e.enviar()).status,200);assert.equal(e.movimientos.length,1)
 assert.equal(e.movimientos[0].origen,tipo==='laboratorio'?'7/'+e.body.archivo:'expedientes/7/'+e.body.archivo)
 assert.equal(e.auditorias.at(-1).fn,'clinica_admin_retirar_documento');assert.equal(e.auditorias.at(-1).params.p_tipo,tipo)
})
