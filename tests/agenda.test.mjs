import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function cargar(ruta, deps = {}) { const js = ts.transpileModule(readFileSync(new URL(ruta, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText; const exports = {}; new Function('require', 'exports', js)((id) => deps[id] ?? require(id), exports); return exports }
const m = cargar('../lib/agenda/modelo.ts'), bloques = [{ dia: 1, inicio: '09:00', fin: '10:00' }], ahora = new Date('2026-11-09T14:00:00Z')
const consulta = cargar('../lib/agenda/consulta.ts')
test('calcula turnos y ocupación reales de 20 minutos sin horarios fijos', () => {
  const r = m.resumirAgenda(bloques, [{ inicio: '2026-11-09T15:00:00Z', fin: '2026-11-09T15:20:00Z', estado: 'pendiente' }], '2026-11-09', 20, ahora)
  assert.equal(r.dias[0].slots.length, 2); assert.equal(r.proximo.inicio, '2026-11-09T15:20:00.000Z'); assert.equal(r.jornadaMinutos, 60); assert.equal(r.ocupadosMinutos, 20)
})
test('el último turno debe caber completo y la duración real del médico manda', () => {
  const r = m.resumirAgenda([{ ...bloques[0], paso: 20 }], [], '2026-11-09', 30, ahora)
  assert.deepEqual(r.dias[0].slots.map(s => s.inicio.slice(11,16)), ['15:00', '15:20']); assert.ok(r.dias[0].slots.every(s => Date.parse(s.fin) <= Date.parse('2026-11-09T16:00:00Z')))
})
test('horario ausente nunca genera disponibilidad ficticia ni porcentaje', () => {
  const r = m.resumirAgenda([], [], '2026-11-09', 20, ahora)
  assert.equal(r.configurado, false); assert.equal(r.proximo, null); assert.equal(r.jornadaMinutos, 0); assert.equal(r.dias.flatMap(d=>d.slots).length, 0)
})
test('citas canceladas liberan intervalos, una atendida ocupa su tiempo histórico', () => {
  const c = { inicio:'2026-11-09T15:00:00Z',fin:'2026-11-09T15:20:00Z' }
  assert.equal(m.resumirAgenda(bloques,[{...c,estado:'cancelada_paciente'}],'2026-11-09',20,ahora).dias[0].slots.length,3)
  assert.equal(m.resumirAgenda(bloques,[{...c,estado:'atendida'}],'2026-11-09',20,ahora).ocupadosMinutos,20)
})
test('citas pegadas no se cruzan y los minutos superpuestos no se cuentan dos veces', () => {
  assert.equal(m.seCruzan({inicio:'2026-11-09T15:00Z',fin:'2026-11-09T15:20Z'},{inicio:'2026-11-09T15:20Z',fin:'2026-11-09T15:40Z'}),false)
  const r=m.resumirAgenda(bloques,[{inicio:'2026-11-09T14:50Z',fin:'2026-11-09T15:20Z'},{inicio:'2026-11-09T15:10Z',fin:'2026-11-09T15:30Z'}],'2026-11-09',20,ahora)
  assert.equal(r.ocupadosMinutos,30)
})
test('usa el día de Ciudad de México, valida fechas y bloques', () => {
  assert.equal(m.fechaClinica(new Date('2026-11-10T02:00:00Z')),'2026-11-09')
  assert.equal(m.instanteClinica('2026-11-09','23:20'),'2026-11-10T05:20:00.000Z')
  assert.throws(()=>m.instanteClinica('2026-02-30','10:00'));assert.throws(()=>m.validarBloques([{dia:1,inicio:'10:00',fin:'09:00'}]));assert.throws(()=>m.validarBloques([...bloques,{dia:1,inicio:'09:30',fin:'11:00'}]))
})
function apiEscenario({ rol = 'recepcionista', sinSesion = false, pausas = [] }={}) {
  const citas=[], perfiles=[{id:1,clinica_id:4,duracion_consulta:20},{id:2,clinica_id:8,duracion_consulta:30}]
  let secuencia=0
  const db={from(tabla){let filtros=[], or='', insertado;const q={select(){return q},in(k,vs){filtros.push(f=>vs.includes(f[k]));return q},limit(){return q},eq(k,v){filtros.push(f=>f[k]===v);return q},or(v){or=v;return q},lt(k,v){filtros.push(f=>f[k]<v);return q},gt(k,v){filtros.push(f=>f[k]>v);return q},insert(v){insertado=v;return q},async single(){const c={id:++secuencia,...insertado};citas.push(c);return {data:c,error:null}},async maybeSingle(){return {data:{id:7,esta_activo:true,usuarios:{esta_activo:true}},error:null}},then(ok,err){return Promise.resolve({data:citas.filter(f=>filtros.every(fn=>fn(f))&&(!or||or.split(',').some(v=>{const[k,,n]=v.split('.');return f[k]===Number(n)}))),error:null}).then(ok,err)}};return q}}
  const srv=cargar('../lib/agenda/servidor.ts',{'./modelo':m,'@/lib/cuenta/servidor':{}})
  const api=cargar('../app/api/citas/route.ts',{'@/lib/agenda/modelo':m,'@/lib/cuenta/servidor':{origenValido:()=>true},'@/lib/agenda/servidor':{...srv,accesoAgenda:async()=>sinSesion?{respuesta:Response.json({error:'Sin sesión'},{status:401})}:{admin:db,usuario:{id:99,rol}},medicoAgenda:async(_db,id)=>{const med=perfiles.find(p=>p.id===id);if(!med)throw new srv.ErrorAgenda('Médico no disponible',404);return med},configuracionMedico:async()=>({bloques:[],descansos:pausas})}})
  const fecha=m.sumarDias(m.fechaClinica(),3)
  const crear=(extra={})=>api.POST(new Request('http://localhost/api/citas',{method:'POST',body:JSON.stringify({pacienteId:7,medicoId:1,fecha,hora:'10:00',motivo:'Prueba',...extra})}))
  return {crear,citas}
}
test('recepción agenda muchas citas para el mismo médico y paciente en intervalos distintos',async()=>{
  const e=apiEscenario();assert.equal((await e.crear()).status,200);assert.equal((await e.crear({hora:'10:20'})).status,200);assert.equal(e.citas.length,2)
})
test('deriva clínica y duración de cada médico sin confiar en campos del navegador',async()=>{
  const e=apiEscenario();await e.crear({medicoId:2,clinicaId:999,duracionConsulta:1});assert.equal(e.citas[0].clinica_id,8);assert.equal((Date.parse(e.citas[0].fin)-Date.parse(e.citas[0].inicio))/60000,30)
})
test('detecta cruces del médico y del paciente entre distintos médicos',async()=>{
  const e=apiEscenario();await e.crear();assert.equal((await e.crear({pacienteId:8,hora:'10:10'})).status,409);assert.equal((await e.crear({medicoId:2,hora:'10:10'})).status,409);assert.equal(e.citas.length,1)
})
test('reservas concurrentes del mismo intervalo generan una sola cita',async()=>{
  const e=apiEscenario();const res=await Promise.all([e.crear(),e.crear()]);assert.deepEqual(res.map(r=>r.status).sort(),[200,409]);assert.equal(e.citas.length,1)
})
test('sin sesión o con rol no autorizado no guarda citas',async()=>{
  const a=apiEscenario({sinSesion:true});assert.equal((await a.crear()).status,401);const b=apiEscenario({rol:'paciente'});assert.equal((await b.crear()).status,403);assert.equal(b.citas.length,0)
})
test('datos clínicos ausentes permanecen vacíos, sin signos ni diagnóstico inventados',async()=>{
  const ficha=cargar('../lib/pacientes/ficha-clinica.ts')
  const db={from(tabla){const q={select(){return q},eq(){return q},gte(){return q},lt(){return q},order(){return q},async maybeSingle(){return {data:null,error:null}},then(ok,err){return Promise.resolve({data:[{id:3,paciente_id:7,inicio:'2026-11-09T15:00Z',fin:'2026-11-09T15:20Z',estado:'pendiente',motivo:'Control',perfiles_pacientes:{usuarios:{nombre_completo:'Paciente real'},notas_medicas:null}}],error:null}).then(ok,err)}};return q}}
  const datos=cargar('../components/modulos/medicos/datos-medicos.ts',{'@/lib/agenda/consulta':consulta,'@/lib/supabase/client':{createClient:()=>db},'@/lib/agenda/modelo':m,'@/lib/pacientes/ficha-clinica':ficha,'@/lib/supabase/datos':{cargarHistorialPaciente:async()=>({filas:[],error:null})}})
  const [cita]=await datos.obtenerCitasAgendaMedico(1,'2026-11-09');assert.equal(cita.signosVitales,undefined);assert.equal(cita.grupoSanguineo,'No registrado');assert.equal(cita.edad,null);assert.equal(cita.ultimaVisita,undefined);assert.deepEqual(cita.soap.diagnosticos,[]);assert.equal(cita.soap.objetivo,'');assert.equal(cita.soap.plan,'')
})
test('descansos rotativos retiran turnos y minutos de atención solo en la fecha asignada',()=>{
  const descansos=[{fecha:'2026-11-09',inicio:'09:20',fin:'09:40'}]
  const r=m.resumirAgenda(bloques,[],'2026-11-09',20,ahora,7,descansos)
  assert.equal(r.jornadaMinutos,40);assert.equal(r.dias[0].slots.length,2);assert.ok(!r.dias[0].slots.some(s=>s.inicio==='2026-11-09T15:20:00.000Z'))
  const otra=m.resumirAgenda(bloques,[],'2026-11-16',20,ahora,7,descansos);assert.equal(otra.jornadaMinutos,60)
  assert.throws(()=>m.validarDescansos([{fecha:'2026-11-09',inicio:'12:00',fin:'11:00'}]));assert.throws(()=>m.validarDescansos([{fecha:'2026-11-09',inicio:'09:00',fin:'10:00'},{fecha:'2026-11-09',inicio:'09:30',fin:'11:00'}]))
})
function horarioApi({rol='admin',conflicto=false}={}) {
  const escrituras=[]
  const medico={id:1,duracion_consulta:20,usuarios:{auth_user_id:'doctor-auth'}}
  const db={storage:{getBucket:async()=>({data:{id:'agenda-medica'},error:null}),from:()=>({upload:async(path,blob)=>{escrituras.push({path,body:JSON.parse(await blob.text())});return {error:null}}})},auth:{admin:{getUserById:async()=>({data:{user:{app_metadata:{provider:'email'}}},error:null}),updateUserById:async(id,body)=>{escrituras.push({id,body});return {error:null}}}},from(){const q={select(){return q},eq(){return q},in(){return q},or(){return q},limit(){return q},lt(){return q},gt(){return q},then(ok,err){return Promise.resolve({data:conflicto?[{id:31,inicio:'2026-11-09T15:00:00Z',fin:'2026-11-09T15:20:00Z',estado:'pendiente'}]:[],error:null}).then(ok,err)}};return q}}
  const srv=cargar('../lib/agenda/servidor.ts',{'./modelo':m,'@/lib/cuenta/servidor':{}})
  const api=cargar('../app/api/agenda/[id]/route.ts',{'@/lib/agenda/modelo':m,'@/lib/cuenta/servidor':{origenValido:()=>true},'@/lib/agenda/servidor':{...srv,accesoAgenda:async()=>({admin:db,usuario:{rol,id:90}}),medicoAgenda:async()=>medico,configuracionMedico:async()=>({bloques:[],descansos:[]})}})
  const guardar=(body={bloques,descansos:[{fecha:'2026-11-09',inicio:'09:00',fin:'09:20'}]})=>api.PATCH(new Request('http://localhost/api/agenda/1',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id:'1'})})
  return {guardar,escrituras}
}
test('solo administración asigna descansos y persiste la configuración privada',async()=>{
  const sinPermiso=horarioApi({rol:'recepcionista'});assert.equal((await sinPermiso.guardar()).status,403);assert.equal(sinPermiso.escrituras.length,0)
  const e=horarioApi();assert.equal((await e.guardar()).status,200);assert.equal(e.escrituras[0].path,'1/horario.json');assert.equal(e.escrituras[0].body.descansos.length,1);assert.equal(e.escrituras[0].body.usuarioId,90)
})
test('asignar descanso sobre una cita activa devuelve conflicto sin modificar el horario',async()=>{
  const e=horarioApi({conflicto:true});const r=await e.guardar();assert.equal(r.status,409);assert.match((await r.json()).error,/cita #31/);assert.equal(e.escrituras.length,0)
})
test('si falla guardar el expediente no marca la cita como atendida',async()=>{
  let cambiosCita=0
  const datos=cargar('../components/modulos/medicos/datos-medicos.ts',{'@/lib/agenda/consulta':consulta,'@/lib/agenda/modelo':m,'@/lib/pacientes/ficha-clinica':{},'@/lib/supabase/datos':{},'@/lib/supabase/client':{createClient:()=>({from(tabla){if(tabla==='citas')cambiosCita++;return {upsert:async()=>({error:{message:'fallo simulado'}})}}})}})
  const r=await datos.finalizarConsultaYFirmar({citaId:1,soap:{subjetivo:'Dato real',objetivo:'',plan:''},diagnosticos:[],prescripciones:[]});assert.equal(r.ok,false);assert.equal(cambiosCita,0)
})

test('incluso sin jornada publicada no se agenda durante un descanso',async()=>{
  const fecha=m.sumarDias(m.fechaClinica(),3), e=apiEscenario({pausas:[{fecha,inicio:'10:00',fin:'10:30'}]});const r=await e.crear();assert.equal(r.status,409);assert.match((await r.json()).error,/descanso asignado/);assert.equal(e.citas.length,0)
})
test('si faltan la tabla y la configuración, devuelve jornada vacía en lugar de inventarla',async()=>{
  const srv=cargar('../lib/agenda/servidor.ts',{'./modelo':m,'@/lib/cuenta/servidor':{}})
  const db={storage:{from:()=>({download:async()=>({data:null,error:{statusCode:404,message:'Object not found'}})})},from:()=>{const q={select(){return q},eq(){return q},then(ok,err){return Promise.resolve({data:null,error:{code:'PGRST205'}}).then(ok,err)}};return q}}
  assert.deepEqual(await srv.configuracionMedico(db,{id:1,usuarios:{auth_user_id:null}}),{bloques:[],descansos:[]})
})

test('reabrir y guardar varias veces no duplica diagnósticos ni prescripciones', () => {
  const soap = { subjetivo: 'Motivo registrado', objetivo: 'Hallazgo registrado', plan: 'Seguimiento registrado' }
  const diagnosticos = [{ codigo: 'Z00.0', descripcion: 'Descripción de prueba', tipo: 'Principal' }]
  const prescripciones = [{ id: '1', nombre: 'Medicamento de prueba', tipo: 'Nuevo', posologia: 'Indicación registrada\nSegunda línea', presentacion: 'Presentación registrada' }]
  let guardado = consulta.escribirConsulta(soap, diagnosticos, prescripciones)
  const original = { ...guardado }
  for (let i = 0; i < 4; i++) {
    const leido = consulta.leerConsulta(guardado)
    assert.deepEqual(leido.soap, { ...soap, diagnosticos })
    guardado = consulta.escribirConsulta(leido.soap, leido.soap.diagnosticos, leido.prescripciones)
    assert.deepEqual(guardado, original)
  }
})

test('los expedientes de texto libre conservan sus notas, diagnóstico y receta al editar', () => {
  const original = { diagnostico: 'Diagnóstico previo\nSegunda línea del diagnóstico.', receta: 'Indicación previa\nSin formato estructurado.', notas_doctor: 'Evolución previa.' }
  const leido = consulta.leerConsulta(original)
  const guardado = consulta.escribirConsulta(leido.soap, leido.soap.diagnosticos, leido.prescripciones)
  assert.equal(guardado.diagnostico, original.diagnostico)
  assert.equal(guardado.receta, original.receta)
  assert.equal(consulta.leerConsulta(guardado).soap.subjetivo, original.notas_doctor)
  assert.equal(leido.soap.plan, '')
})

test('el borrador vacío no crea diagnóstico, receta ni hallazgos de ejemplo', () => {
  const { soap, prescripciones } = consulta.leerConsulta()
  const guardado = consulta.escribirConsulta(soap, soap.diagnosticos, prescripciones)
  assert.equal(guardado.diagnostico, '')
  assert.equal(guardado.receta, '')
  assert.deepEqual(consulta.leerConsulta(guardado).soap, soap)
})
