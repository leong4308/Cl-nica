import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { hashVinculo } from '../lib/notificaciones/telegram.mjs'
import { procesarActualizaciones, entregarPendientes } from '../lib/notificaciones/trabajador.mjs'
import { botonesParaCita } from '../lib/notificaciones/respuestas-citas.mjs'
import { respuestasInstaladasManualmente } from '../lib/operacion/migracion-manual.mjs'
import { CONSULTAS_TELEGRAM } from '../lib/notificaciones/almacen.mjs'
let db, dbBot
const reservaBot='12345678-1234-4234-8234-123456789012'
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
before(async () => {
  db = new PGlite({ extensions: { btree_gist } })
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
  await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'))
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated; grant usage,select on all sequences in schema public to authenticated;
    insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}'),('${uid(4)}'),('${uid(5)}'),('${uid(6)}');
    insert into usuarios(id,auth_user_id,correo,nombre_completo,rol) values
      (1,'${uid(1)}','admin@test.local','Admin','admin'),(2,'${uid(2)}','ana@test.local','Ana','medico'),(3,'${uid(3)}','jorge@test.local','Jorge','medico'),
      (4,'${uid(4)}','recepcion@test.local','Recepción','recepcionista'),(5,'${uid(5)}','enfermeria@test.local','Enfermería','enfermero'),
      (6,'${uid(6)}','paciente@test.local','Paciente uno','paciente'),(7,null,'otro@test.local','Paciente dos','paciente'),(8,null,'tercero@test.local','Paciente tres','paciente');
    insert into clinicas(id,nombre) values(1,'Clínica');
    insert into perfiles_medicos(id,usuario_id,clinica_id,especialidad,cedula_profesional) values(1,2,1,'General','A'),(2,3,1,'General','B');
    insert into perfiles_pacientes(id,usuario_id) values(1,6),(2,7),(3,8);
    insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin,estado) values(100,1,1,1,'2026-01-01 10:00Z','2026-01-01 10:20Z','atendida'),(101,2,2,1,'2026-01-02 10:00Z','2026-01-02 10:20Z','atendida');
    insert into expedientes(id,cita_id,diagnostico) values(100,100,'Nota de prueba'),(101,101,'Otra nota');
    insert into habitaciones(id,clinica_id,numero,tipo,capacidad) values(1,1,'101','General',2);
    insert into camas(id,habitacion_id,numero) values(1,1,'A'),(2,1,'B');`)
  await db.exec("insert into perfiles_enfermeros(id,usuario_id,clinica_id) values(1,5,1); insert into auth.sessions select id,id from auth.users")
  for(const tabla of ['usuarios','perfiles_pacientes']) await db.exec(`select setval(pg_get_serial_sequence('${tabla}','id'),(select max(id) from ${tabla}))`)
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql']) await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'))
  await db.query('select clinica_reservar_trabajador($1)',[reservaBot])
  dbBot=process.env.PROBAR_TELEGRAM_SQL_DIRECTO==='true'?db:{operar:async(operacion,parametros)=>({rows:(await db.query('select clinica_operar_telegram($1,$2,$3) r',[reservaBot,operacion,JSON.stringify(parametros)])).rows[0].r})}
})
after(async () => { await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}


test('la migración de enfermería se instala',async()=>{assert.equal((await db.query('select clinica_version() v')).rows[0].v,29)})

let secuencia=700, turnoId, ingresoId, episodioId, medicamentoId
const clave=()=>uid(secuencia++)
async function operar(n,accion,datos,k=clave()){return (await como(n,tx=>tx.query('select clinica_enfermeria_operar($1,$2,$3) r',[accion,JSON.stringify(datos),k]))).rows[0].r}
test('el enfermero solo lee pacientes asignados y pierde acceso al terminar el turno; médicos conservan su ámbito',async()=>{
 assert.equal((await como(5,tx=>tx.query('select id from perfiles_pacientes'))).rows.length,0)
 assert.equal((await como(5,tx=>tx.query('select id from citas'))).rows.length,0)
 assert.equal((await como(2,tx=>tx.query('select id from perfiles_pacientes'))).rows.length,1)
 const inicio=new Date(Date.now()-60_000).toISOString(),fin=new Date(Date.now()+8*3600_000).toISOString()
 const solicitud={pacienteId:1,enfermeroId:1,inicio,fin,area:'Hospitalización'},k=clave()
 turnoId=(await operar(1,'asignar',solicitud,k)).id
 assert.equal((await operar(1,'asignar',solicitud,k)).id,turnoId)
 assert.deepEqual((await como(5,tx=>tx.query('select id from perfiles_pacientes'))).rows.map(p=>p.id),[1])
 assert.deepEqual((await como(5,tx=>tx.query('select id from citas'))).rows.map(p=>p.id),[100])
 await assert.rejects(operar(5,'nota',{pacienteId:2,texto:'No permitido'}),e=>e.code==='42501')
 await assert.rejects(operar(5,'asignar',solicitud),e=>e.code==='42501')
 await db.query("update enfermeria_turnos set fin=clock_timestamp()-interval '1 second',inicio=clock_timestamp()-interval '1 hour' where id=$1",[turnoId])
 assert.equal((await como(5,tx=>tx.query('select id from perfiles_pacientes'))).rows.length,0)
 await db.query("update enfermeria_turnos set fin=clock_timestamp()+interval '8 hours' where id=$1",[turnoId])
 const panel=(await como(5,tx=>tx.query('select clinica_enfermeria_panel() r'))).rows[0].r
 assert.equal(panel.pacientes.length,1);assert.equal(panel.usuarioId,5)
})
test('notas, signos y correcciones conservan el original, autor e idempotencia y no permiten escritura directa',async()=>{
 const datos={pacienteId:1,texto:'Valoración y cuidados documentados'},k=clave(),r=await operar(5,'nota',datos,k)
 assert.equal((await operar(5,'nota',datos,k)).id,r.id)
 await assert.rejects(operar(5,'nota',{...datos,texto:'Otro contenido'},k),e=>e.code==='40001')
 const correccion=await operar(5,'correccion',{pacienteId:1,corrigeId:r.id,texto:'Corrección explicada'})
 assert.ok(correccion.id>r.id)
 assert.equal((await db.query('select datos from enfermeria_registros where id=$1',[r.id])).rows[0].datos.texto,datos.texto)
 await assert.rejects(como(5,tx=>tx.query("update enfermeria_registros set datos='{}' where id=$1",[r.id])),e=>e.code==='42501')
 await assert.rejects(operar(5,'signos',{pacienteId:1,valores:{saturacion:120}}))
 await operar(5,'signos',{pacienteId:1,valores:{pulso:72,temperatura:36.5}})
 await assert.rejects(como(5,tx=>tx.query('select clinica_actualizar_paciente(1,$1)',['{}'])),e=>e.code==='42501')
 await operar(5,'contacto',{pacienteId:1,telefono:'5551234567',contacto:'Familiar',telefonoEmergencia:'5557654321'})
 assert.equal((await db.query('select telefono from usuarios where id=6')).rows[0].telefono,'5551234567')
})
test('enfermería no prescribe ni valida resultados; el seguimiento usa estados cerrados',async()=>{
 ingresoId=(await como(2,tx=>tx.query('select clinica_hospital(null,$1) r',[JSON.stringify({accion:'crear',pacienteId:1,medicoId:1,camaId:1,motivo:'Seguimiento'})]))).rows[0].r.id
 episodioId=(await db.query('select id from episodios_medicos where internacion_id=$1 order by id limit 1',[ingresoId])).rows[0].id
 medicamentoId=(await como(2,tx=>tx.query("insert into ordenes_medicas(episodio_id,tipo_orden,descripcion,instrucciones) values($1,'medicamento','Medicación indicada','Indicación del médico') returning id",[episodioId]))).rows[0].id
 await assert.rejects(como(5,tx=>tx.query("insert into ordenes_medicas(episodio_id,tipo_orden,descripcion) values($1,'medicamento','No permitido')",[episodioId])),e=>e.code==='42501')
 assert.equal((await como(5,tx=>tx.query("update ordenes_medicas set instrucciones='Alteración' where id=$1 returning id",[medicamentoId]))).rows.length,0)
 assert.equal((await db.query('select instrucciones from ordenes_medicas where id=$1',[medicamentoId])).rows[0].instrucciones,'Indicación del médico')
 await db.exec("insert into catalogo_analisis(id,nombre) values(1,'Estudio de prueba')")
 const estudio=(await db.query('insert into solicitudes_analisis(orden_medica_id,analisis_id) values($1,1) returning id',[medicamentoId])).rows[0].id
 assert.equal((await como(5,tx=>tx.query("update solicitudes_analisis set resultado='No permitido',estado_analisis='completado' where id=$1 returning id",[estudio]))).rows.length,0)
 await operar(5,'muestra',{pacienteId:1,solicitudId:estudio,etapa:'tomada'})
 await operar(5,'muestra',{pacienteId:1,solicitudId:estudio,etapa:'entregada'})
 await assert.rejects(operar(5,'muestra',{pacienteId:1,solicitudId:estudio,etapa:'entregada'}),e=>e.code==='40001')
 assert.equal((await db.query('select resultado from solicitudes_analisis where id=$1',[estudio])).rows[0].resultado,null)
})
test('las dosis exigen prescripción vigente, hora cumplida, identidad y un único registro',async()=>{
 const datos={pacienteId:1,tipo:'medicamento',titulo:'Dosis programada',ordenId:medicamentoId,dosis:'Dosis del prescriptor',via:'Vía prescrita',programada:new Date(Date.now()-1000).toISOString()}
 await assert.rejects(operar(5,'programar',datos),e=>e.code==='42501')
 const t=await operar(2,'programar',datos)
 await assert.rejects(operar(2,'programar',datos),e=>e.code==='23505')
 const k=clave(),registro={pacienteId:1,tareaId:t.id,estado:'realizada',confirmado:true,texto:'Realizado según indicación'}
 await assert.rejects(operar(5,'cumplir',{...registro,confirmado:false}))
 const resultado=await operar(5,'cumplir',registro,k)
 assert.equal((await operar(5,'cumplir',registro,k)).id,resultado.id)
 await assert.rejects(operar(5,'cumplir',registro),e=>e.code==='40001')
 const otra=await operar(2,'programar',{...datos,programada:new Date(Date.now()+30000).toISOString()})
 await assert.rejects(operar(5,'cumplir',{...registro,tareaId:otra.id}),/hora programada/)
 await db.query("update enfermeria_tareas set programada=clock_timestamp()-interval '1 minute' where id=$1",[otra.id])
 await como(2,tx=>tx.query("update ordenes_medicas set instrucciones='Indicación revisada' where id=$1",[medicamentoId]))
 await assert.rejects(operar(5,'cumplir',{...registro,tareaId:otra.id}),e=>e.code==='40001')
})
test('incidencias y límites indicados por el médico generan avisos y el médico confirma su revisión',async()=>{
 await operar(2,'programar',{pacienteId:1,tipo:'control',titulo:'Control indicado',programada:new Date(Date.now()-1000).toISOString(),parametro:'pulso',minimo:60,maximo:100})
 await operar(5,'signos',{pacienteId:1,valores:{pulso:110}})
 const alerta=(await db.query("select id from enfermeria_registros where tipo='incidencia' order by id desc limit 1")).rows[0]
 assert.ok(alerta)
 assert.ok((await db.query("select id from notificaciones where usuario_id=2 and tipo='enfermeria'")).rows.length>0)
 await assert.rejects(operar(5,'acusar',{pacienteId:1,registroId:alerta.id,texto:'No soy el médico'}),e=>e.code==='42501')
 await operar(2,'acusar',{pacienteId:1,registroId:alerta.id,texto:'Incidencia revisada'})
 assert.equal((await db.query('select respuesta from enfermeria_acuses where registro_id=$1',[alerta.id])).rows[0].respuesta,'Incidencia revisada')
})
test('la entrega exige destinatario asignado y guarda quién recibe',async()=>{
 await db.query('insert into auth.users values($1)',[uid(9)])
 await db.query("insert into usuarios(id,auth_user_id,correo,nombre_completo,rol) values(9,$1,'relevo@test.local','Enfermero de relevo','enfermero')",[uid(9)])
 await db.query('insert into auth.sessions values($1,$1)',[uid(9)])
 await db.exec("insert into perfiles_enfermeros(id,usuario_id,clinica_id) values(2,9,1)")
 await como(9,tx=>tx.query('select clinica_estado_sesion()'))
 await assert.rejects(operar(5,'entrega',{pacienteId:1,destinatario:2,texto:'Pendientes del turno'}))
 await operar(1,'asignar',{pacienteId:1,enfermeroId:2,inicio:new Date(Date.now()-1000).toISOString(),fin:new Date(Date.now()+8*3600000).toISOString(),area:'Hospitalización'})
 const r=await operar(5,'entrega',{pacienteId:1,destinatario:2,texto:'Pendientes y evolución del turno'})
 await operar(9,'acusar',{pacienteId:1,registroId:r.id,texto:'Recibí y revisé los pendientes'})
 assert.equal((await db.query('select autor from enfermeria_acuses where registro_id=$1',[r.id])).rows[0].autor,9)
})
test('enfermería ejecuta solo movimientos autorizados por un médico y la autorización no se reutiliza',async()=>{
 const ingreso=(await db.query('select actualizado_en from internaciones where id=$1',[ingresoId])).rows[0]
 await assert.rejects(como(5,tx=>tx.query('select clinica_hospital($1,$2)',[ingresoId,JSON.stringify({accion:'alta',version:ingreso.actualizado_en,confirmado:true,notaAlta:'Sin autorización'})])),e=>e.code==='42501')
 const solicitud={pacienteId:1,internacionId:ingresoId,version:ingreso.actualizado_en,tipo:'alta',texto:'Alta autorizada por el médico'}
 await assert.rejects(operar(1,'autorizar',solicitud),e=>e.code==='42501')
 await operar(2,'autorizar',solicitud)
 const autorizacion=(await db.query('select id from enfermeria_movimientos where internacion_id=$1',[ingresoId])).rows[0].id
 await operar(5,'movimiento',{pacienteId:1,autorizacionId:autorizacion,confirmado:true,texto:'Salida y cuidados documentados'})
 assert.equal((await db.query('select estado from internaciones where id=$1',[ingresoId])).rows[0].estado,'alta')
 assert.equal((await db.query('select esta_ocupada from camas where id=1')).rows[0].esta_ocupada,false)
 await assert.rejects(operar(5,'movimiento',{pacienteId:1,autorizacionId:autorizacion,confirmado:true,texto:'Repetir'}),e=>e.code==='40001')
})

test('las entradas antiguas privadas no permiten eludir los permisos de enfermería',async()=>{
 await assert.rejects(como(5,tx=>tx.query('select clinica_paciente_v27(2)')),e=>e.code==='42501')
 await assert.rejects(como(5,tx=>tx.query("select clinica_hospital_v27(null,'{}')")),e=>e.code==='42501')
 await assert.rejects(como(5,tx=>tx.query("select clinica_registrar_paciente('{}')")),e=>e.code==='42501')
 assert.equal((await como(5,tx=>tx.query('select id from usuarios where id=7'))).rows.length,0)
 await assert.rejects(como(6,tx=>tx.query('select clinica_enfermeria_panel()')),e=>e.code==='42501')
 await assert.rejects(como(5,tx=>tx.query("select clinica_enfermeria_operar_v28('nota','{}',$1)",[clave()])),e=>e.code==='42501')
})

test('un control específico exige esa medición y no admite una hora anterior a su programación',async()=>{
 const programada=new Date(Date.now()-1000).toISOString()
 const tarea=await operar(2,'programar',{pacienteId:1,tipo:'control',titulo:'Control de saturación',programada,parametro:'saturacion',minimo:80,maximo:100})
 await operar(5,'signos',{pacienteId:1,valores:{temperatura:36.5}})
 const registro={pacienteId:1,tareaId:tarea.id,estado:'realizada',confirmado:true}
 await assert.rejects(operar(5,'cumplir',registro),/signos vitales/)
 await operar(5,'signos',{pacienteId:1,valores:{saturacion:98}})
 await assert.rejects(operar(5,'cumplir',{...registro,observadoEn:new Date(Date.now()-3600000).toISOString()}),/hora observada/)
 await operar(5,'cumplir',registro)
 assert.equal((await db.query('select estado from enfermeria_tareas where id=$1',[tarea.id])).rows[0].estado,'realizada')
})

test('retirar una asignación revoca acceso y conserva el registro de lo realizado',async()=>{
 const registros=(await db.query('select count(*)::int n from enfermeria_registros where paciente_id=1')).rows[0].n
 await operar(1,'retirar_turno',{pacienteId:1,turnoId,texto:'Cambio de cobertura del turno'})
 assert.equal((await como(5,tx=>tx.query('select id from perfiles_pacientes'))).rows.length,0)
 await assert.rejects(operar(5,'nota',{pacienteId:1,texto:'Fuera del turno'}),e=>e.code==='42501')
 assert.ok((await db.query('select count(*)::int n from enfermeria_registros where paciente_id=1')).rows[0].n>=registros)
 assert.equal(await respuestasInstaladasManualmente(db,readFileSync(new URL('../supabase/migraciones/028_enfermeria.sql',import.meta.url),'utf8')),true)
 assert.equal(await respuestasInstaladasManualmente(db,readFileSync(new URL('../supabase/migraciones/027_autogestion_y_sesiones.sql',import.meta.url),'utf8')),true)
})
