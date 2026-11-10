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
    create schema auth; create table auth.users(id uuid primary key);
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
  for(const tabla of ['usuarios','perfiles_pacientes']) await db.exec(`select setval(pg_get_serial_sequence('${tabla}','id'),(select max(id) from ${tabla}))`)
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql']) await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'))
})
after(async () => { await db?.close() })
async function como(n, fn) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true)`)
    return fn(tx)
  })
}
test('RLS impide consultar pacientes y expedientes ajenos incluso con SQL directo', async () => {
  const pacientes=await como(2, tx=>tx.query('select id from perfiles_pacientes order by id'))
  assert.deepEqual(pacientes.rows.map(p=>p.id),[1])
  assert.deepEqual((await como(2,tx=>tx.query('select id from expedientes order by id'))).rows.map(p=>p.id),[100])
  assert.equal((await como(1,tx=>tx.query('select id from perfiles_pacientes'))).rows.length,3)
  assert.equal((await como(6,tx=>tx.query('select id from perfiles_pacientes'))).rows.length,1)
})
test('un usuario no puede elevar su rol ni editar la bitácora', async () => {
  await assert.rejects(como(2,tx=>tx.query("update usuarios set rol='admin' where id=2")),/permission denied/)
  await assert.rejects(como(1,tx=>tx.query("insert into auditoria_clinica(tabla,registro_id,accion) values('x','1','x')")),/permission denied/)
})
test('un trigger de registro de Auth no puede convertir metadatos de usuario en un rol administrativo',async()=>{
 await db.exec("create function alta_auth_prueba() returns trigger language plpgsql security definer as $$begin insert into public.usuarios(auth_user_id,correo,nombre_completo,rol) values(new.id,'alta-no-confiable@test.local','Registro externo','admin');return new;end$$;create trigger alta_auth_prueba after insert on auth.users for each row execute function alta_auth_prueba()")
 await db.query('insert into auth.users values($1)',[uid(99)])
 assert.equal((await db.query('select rol from usuarios where auth_user_id=$1',[uid(99)])).rows[0].rol,'paciente')
 await db.exec('drop trigger alta_auth_prueba on auth.users;drop function alta_auth_prueba()')
})
test('no se puede desactivar el último administrador',async()=>{
  await assert.rejects(db.query('update usuarios set esta_activo=false where id=1'),/administrador activo/)
  assert.equal((await db.query('select esta_activo from usuarios where id=1')).rows[0].esta_activo,true)
})
test('registrar un paciente como médico lo vincula y no crea cuentas privilegiadas',async()=>{
 const resultado=(await como(2,tx=>tx.query('select clinica_registrar_paciente($1) as r',[JSON.stringify({nombre:'Paciente recién registrado',correo:'nuevo@test.local',rol:'admin',fechaNacimiento:'1990-01-01',genero:'F'})]))).rows[0].r
 assert.equal((await como(2,tx=>tx.query('select id from perfiles_pacientes where id=$1',[resultado.id]))).rows.length,1)
 assert.equal((await db.query("select rol from usuarios where correo='nuevo@test.local'")).rows[0].rol,'paciente')
})
test('una falla al guardar el perfil revierte también los datos personales y su auditoría',async()=>{
 const previo=(await db.query('select nombre_completo from usuarios where id=6')).rows[0].nombre_completo
 await db.exec("create function fallo_perfil_prueba() returns trigger language plpgsql as $$begin raise exception 'Fallo de perfil simulado'; end$$;create trigger fallo_perfil before update on perfiles_pacientes for each row execute function fallo_perfil_prueba()")
 await assert.rejects(como(1,tx=>tx.query('select clinica_actualizar_paciente(1,$1)',[JSON.stringify({nombre:'Cambio que debe revertirse',fechaNacimiento:'1991-01-01',genero:'F'})])),/simulado/)
 await db.exec('drop trigger fallo_perfil on perfiles_pacientes;drop function fallo_perfil_prueba()')
 assert.equal((await db.query('select nombre_completo from usuarios where id=6')).rows[0].nombre_completo,previo)
})
test('asignación y transferencia tienen versión, autor y revocan acceso anterior', async () => {
  const version=(await como(1,tx=>tx.query('select clinica_version_asignacion(1) as version'))).rows[0].version
  await assert.rejects(como(2,tx=>tx.query('select clinica_asignar_medicos(1,$1,$2,$3)',[JSON.stringify([{id:2,tipo:'principal'}]),version,'Transferencia'])),/administración/)
  await como(1,tx=>tx.query('select clinica_asignar_medicos(1,$1,$2,$3)',[JSON.stringify([{id:2,tipo:'principal'}]),version,'Transferencia a otro médico']))
  assert.equal((await como(2,tx=>tx.query('select id from perfiles_pacientes where id=1'))).rows.length,0)
  assert.equal((await como(3,tx=>tx.query('select id from perfiles_pacientes where id=1'))).rows.length,1)
  const historia=(await como(3,tx=>tx.query('select clinica_historial_paciente(1) as historia'))).rows[0].historia
  assert.equal(historia[0].diagnostico,'Nota de prueba')
  await assert.rejects(como(2,tx=>tx.query('select clinica_historial_paciente(1)')),e=>e.code==='42501')
  await assert.rejects(como(1,tx=>tx.query('select clinica_asignar_medicos(1,$1,$2,$3)',['[]',version,'Cambio antiguo'])),/cambió/)
  const auditoria=await como(1,tx=>tx.query("select autor,anterior,nuevo from auditoria_clinica where tabla='paciente_medicos' and registro_id like '1:%' order by id"))
  assert.ok(auditoria.rows.length>=2);assert.ok(auditoria.rows.every(r=>r.autor===uid(1)))
})
test('la base impide solapar al médico y al paciente, pero admite citas consecutivas', async () => {
  const fecha='2035-01-01T16:00:00Z'
  await como(4,tx=>tx.query('select clinica_crear_cita(2,2,$1,$2)',[fecha,'Prueba']))
  await assert.rejects(como(4,tx=>tx.query('select clinica_crear_cita(3,2,$1,$2)',[fecha,'Cruce médico'])),e=>e.code==='23P01')
  await assert.rejects(como(4,tx=>tx.query('select clinica_crear_cita(2,1,$1,$2)',[fecha,'Cruce paciente'])),e=>e.code==='23P01')
  await como(4,tx=>tx.query('select clinica_crear_cita(2,2,$1,$2)',['2035-01-01T16:20:00Z','Consecutiva']))
})
test('descansos y reservas comparten bloqueo; no se guarda un descanso sobre una cita', async () => {
  await assert.rejects(como(1,tx=>tx.query('select clinica_guardar_agenda(2,$1,$2)',['[]',JSON.stringify([{fecha:'2035-01-01',inicio:'10:00',fin:'10:20'}])])),e=>e.code==='23P01')
  await como(1,tx=>tx.query('select clinica_guardar_agenda(2,$1,$2)',['[]',JSON.stringify([{fecha:'2035-01-01',inicio:'11:00',fin:'11:20'}])]))
  await assert.rejects(como(4,tx=>tx.query('select clinica_crear_cita(2,2,$1,$2)',['2035-01-01T17:00:00Z','Descanso'])),e=>e.code==='23P01')
})
test('ingreso, cama y movimiento se guardan o revierten juntos', async () => {
  await db.exec("create function rechazar_evento_prueba() returns trigger language plpgsql as $$begin raise exception 'Fallo de auditoría simulado'; end$$; create trigger fallo_prueba before insert on episodios_medicos for each row execute function rechazar_evento_prueba()")
  await assert.rejects(como(1,tx=>tx.query('select clinica_hospital(null,$1)',[JSON.stringify({pacienteId:3,medicoId:2,camaId:1,motivo:'Observación'})])),/simulado/)
  assert.equal((await db.query('select esta_ocupada from camas where id=1')).rows[0].esta_ocupada,false)
  assert.equal((await db.query('select count(*)::integer as n from internaciones')).rows[0].n,0)
  await db.exec('drop trigger fallo_prueba on episodios_medicos; drop function rechazar_evento_prueba()')
  const id=(await como(1,tx=>tx.query('select clinica_hospital(null,$1) as resultado',[JSON.stringify({pacienteId:3,medicoId:2,camaId:1,motivo:'Observación'})]))).rows[0].resultado.id
  await assert.rejects(como(1,tx=>tx.query('select clinica_hospital(null,$1)',[JSON.stringify({pacienteId:2,medicoId:2,camaId:1,motivo:'Otra admisión'})])),/activo/)
  const ingreso=(await db.query('select * from internaciones where id=$1',[id])).rows[0]
  await como(1,tx=>tx.query('select clinica_hospital($1,$2)',[id,JSON.stringify({accion:'alta',version:ingreso.actualizado_en,confirmado:true,notaAlta:'Egreso documentado'})]))
  assert.equal((await db.query('select esta_ocupada from camas where id=1')).rows[0].esta_ocupada,false)
  assert.equal((await db.query('select count(*)::integer as n from episodios_medicos where internacion_id=$1',[id])).rows[0].n,2)
})
