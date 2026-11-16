import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
let db
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
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql']) await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'))
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}

let secuencia=900
const clave=()=>uid(secuencia++)
async function version(cita) { return (await db.query("select md5(concat_ws(':',id,inicio,fin,estado,actualizado_en)) v from citas where id=$1",[cita])).rows[0].v }
async function operar(n,cita,accion,motivo=null,k=clave(),v=null) { return (await como(n,tx=>tx.query('select clinica_recepcion_operar($1,$2,$3,$4,$5) r',[cita,v,accion,motivo,k]))).rows[0].r }
async function accion(n,cita,a,motivo=null,k=clave(),v=null){return operar(n,cita,a,motivo,k,v??await version(cita))}
// Estas pruebas parten de reservas ya existentes; fechas de clínica estables incluso cerca de medianoche.
async function citaImportada(id,dias,hora,medico=1,paciente=1){
 await db.transaction(async tx=>{
  await tx.exec('alter table citas disable trigger user')
  await tx.query("insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin,motivo) select $1,$2,$3,1,t,t+interval '20 minutes','Consulta' from (select (((statement_timestamp() at time zone 'America/Mexico_City')::date+$4::int+$5::time) at time zone 'America/Mexico_City') t) q",[id,paciente,medico,dias,hora])
  await tx.exec('alter table citas enable trigger user')
 })
}

test('versión 30 y directorio sin notas ni expedientes; otros roles conservan sus datos',async()=>{
 assert.equal((await db.query('select clinica_version() v')).rows[0].v,30)
 await db.exec("update perfiles_pacientes set notas_medicas='Dato clínico privado' where id=1")
 const r=(await como(4,tx=>tx.query('select clinica_directorio_recepcion() r'))).rows[0].r
 assert.equal(r.length,3); assert.equal(r[0].usuarios.nombre_completo,'Paciente uno'); assert.ok(!JSON.stringify(r).includes('Dato clínico privado')); assert.ok(!('notas_medicas' in r[0]))
 assert.equal((await como(4,tx=>tx.query('select * from perfiles_pacientes'))).rows.length,0)
 assert.equal((await como(4,tx=>tx.query('select * from expedientes'))).rows.length,0)
 assert.equal((await como(2,tx=>tx.query('select notas_medicas from perfiles_pacientes where id=1'))).rows[0].notas_medicas,'Dato clínico privado')
 await assert.rejects(como(6,tx=>tx.query('select clinica_directorio_recepcion()')),e=>e.code==='42501')
 await assert.rejects(como(4,tx=>tx.query('select clinica_historial_paciente(1)')),e=>e.code==='42501')
})
test('recepción actualiza contactos pero tampoco puede introducir notas clínicas mediante RPC',async()=>{
 const r=await como(4,tx=>tx.query("select clinica_actualizar_paciente(1,'{\"nombre\":\"Paciente uno\",\"telefono\":\"5551234567\",\"genero\":\"F\"}') r"))
 assert.ok(r.rows[0].r)
 await assert.rejects(como(4,tx=>tx.query("select clinica_registrar_paciente('{\"nombre\":\"Intrusión\",\"notasMedicas\":\"Nota ajena\"}')")),e=>e.code==='42501')
 assert.equal((await db.query('select notas_medicas from perfiles_pacientes where id=1')).rows[0].notas_medicas,'Dato clínico privado')
})
test('llegada idempotente mantiene pendiente la consulta y notifica al médico',async()=>{
 await citaImportada(200,0,'10:00')
 const k=clave(),v=await version(200)
 await accion(4,200,'llegada',null,k,v)
 await accion(4,200,'llegada',null,k,v)
 assert.equal((await db.query('select estado from citas where id=200')).rows[0].estado,'pendiente')
 assert.equal((await db.query('select count(*)::int n from recepcion_eventos where cita_id=200')).rows[0].n,1)
 assert.equal((await db.query("select count(*)::int n from notificaciones where usuario_id=2 and titulo='Paciente en sala de espera'")).rows[0].n,1)
 const p=(await como(4,tx=>tx.query('select clinica_recepcion_panel() r'))).rows[0].r
 assert.ok(p.citas.find(c=>c.id===200).llegada)
 await assert.rejects(accion(4,200,'llegada'),/ya está registrada/)
 await assert.rejects(accion(4,200,'cancelar','Otro',k,v),e=>e.code==='40001')
 await assert.rejects(como(4,tx=>tx.query("update citas set estado='atendida' where id=200")),e=>e.code==='42501')
})
test('solo el médico de la cita inicia la consulta y recepción no la cancela ni reabre',async()=>{
 await assert.rejects(accion(4,200,'iniciar'),e=>e.code==='42501')
 await assert.rejects(accion(3,200,'iniciar'),e=>e.code==='42501')
 await accion(2,200,'iniciar')
 assert.ok((await db.query('select en_consulta from recepcion_llegadas where cita_id=200')).rows[0].en_consulta)
 await citaImportada(204,0,'11:00',1,3)
 await accion(4,204,'llegada')
 await assert.rejects(accion(2,204,'iniciar'),/consulta en curso/)
 await assert.rejects(accion(4,200,'cancelar','Ya no desea acudir'),/ya comenzó/)
 await como(2,tx=>tx.query("update citas set estado='atendida' where id=200"))
 await accion(2,204,'iniciar')
 await como(2,tx=>tx.query("update citas set estado='atendida' where id=204"))
 await assert.rejects(como(4,tx=>tx.query("update citas set estado='confirmada' where id=200")),e=>e.code==='42501')
 await assert.rejects(como(3,tx=>tx.query('select clinica_recepcion_estado(200)')),e=>e.code==='42501')
})
test('cancelar requiere motivo y no asistir solo se registra después del horario',async()=>{
 await citaImportada(201,1,'12:00')
 await assert.rejects(accion(4,201,'cancelar'),/motivo/)
 await assert.rejects(accion(4,201,'no_asistio','No llegó'),/después del horario/)
 await accion(4,201,'cancelar','El paciente solicitó cancelar')
 assert.equal((await db.query('select estado,motivo_cancelacion from citas where id=201')).rows[0].motivo_cancelacion,'El paciente solicitó cancelar')
 await citaImportada(202,-1,'12:00',2,2)
 await accion(4,202,'no_asistio','No se presentó al finalizar su horario')
 assert.equal((await db.query('select estado from citas where id=202')).rows[0].estado,'no_asistio')
})
test('las versiones vencidas y roles ajenos no pueden registrar acciones',async()=>{
 await citaImportada(203,1,'13:00',2,2)
 const anterior=await version(203)
 await accion(4,203,'confirmar')
 await assert.rejects(accion(4,203,'cancelar','Cambio',clave(),anterior),e=>e.code==='40001')
 await assert.rejects(accion(6,203,'llegada'),e=>e.code==='42501')
 await assert.rejects(como(4,tx=>tx.query("insert into recepcion_llegadas(cita_id,inicio_cita,autor,clave) select id,inicio,4,$1 from citas where id=203",[clave()])),e=>e.code==='42501')
})
test('la sesión bloqueada no consulta el directorio administrativo ni registra llegadas',async()=>{
 await db.query('update sesiones_clinica set bloqueada_en=clock_timestamp() where auth_user_id=$1',[uid(4)])
 await assert.rejects(como(4,tx=>tx.query('select clinica_directorio_recepcion()')),e=>e.code==='42501')
 await assert.rejects(accion(4,203,'llegada'),e=>e.code==='42501')
 await db.query('update sesiones_clinica set bloqueada_en=null where auth_user_id=$1',[uid(4)])
})
test('las llegadas de enfermería se reflejan en recepción y el médico conserva su consulta',async()=>{
 // La reserva anterior está a seis horas y puede caer mañana al ejecutar por la noche.
 await db.exec('alter table citas disable trigger user')
 await db.exec("update citas set inicio=((clock_timestamp() at time zone 'America/Mexico_City')::date+time '12:00') at time zone 'America/Mexico_City',fin=((clock_timestamp() at time zone 'America/Mexico_City')::date+time '12:20') at time zone 'America/Mexico_City' where id=203")
 await db.exec('alter table citas enable trigger user')
 const inicio=new Date(Date.now()-60000).toISOString(),fin=new Date(Date.now()+8*3600000).toISOString()
 await como(1,tx=>tx.query('select clinica_enfermeria_operar($1,$2,$3)',['asignar',JSON.stringify({pacienteId:2,enfermeroId:1,inicio,fin,area:'Consulta'}),clave()]))
 await como(5,tx=>tx.query('select clinica_enfermeria_operar($1,$2,$3)',['llegada',JSON.stringify({pacienteId:2,citaId:203}),clave()]))
 const r=(await como(4,tx=>tx.query('select clinica_recepcion_panel() r'))).rows[0].r
 assert.ok(r.citas.find(c=>c.id===203).llegada)
 assert.equal((await db.query('select estado from citas where id=203')).rows[0].estado,'confirmada')
 await accion(3,203,'iniciar')
 await assert.rejects(accion(4,203,'llegada'),/ya está registrada/)
 await como(3,tx=>tx.query("update citas set estado='atendida' where id=203"))
})


