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
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql']) await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'))
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}

let secuencia=3000
const clave=()=>uid(++secuencia)
const catalogo=async(n=1)=>(await como(n,tx=>tx.query('select clinica_catalogo_camas() r'))).rows[0].r
const operar=async(accion,datos,k=clave(),n=1)=>(await como(n,tx=>tx.query('select clinica_catalogo_camas_operar($1,$2,$3) r',[accion,JSON.stringify(datos),k]))).rows[0].r
let habitacion,cama
test('catálogo exclusivo de administración y escritura directa denegada',async()=>{
 assert.equal((await catalogo()).camas.length,2)
 for(const n of [2,3,4,5,6]) {
  await assert.rejects(catalogo(n),e=>e.code==='42501')
  await assert.rejects(operar('crear_habitacion',{clinicaId:1,numero:'202',tipo:'General',capacidad:1},clave(),n),e=>e.code==='42501')
 }
 await assert.rejects(como(1,tx=>tx.query("insert into camas(habitacion_id,numero) values(1,'C')")),e=>e.code==='42501')
 await assert.rejects(como(1,tx=>tx.query("update habitaciones set capacidad=5 where id=1")),e=>e.code==='42501')
 await assert.rejects(como(1,tx=>tx.query('delete from camas where id=2')),e=>e.code==='42501')
})
test('creación normalizada, secuencias seguras, capacidad e idempotencia',async()=>{
 const d={clinicaId:1,numero:'Habitación 202',tipo:'General',capacidad:1},k=clave()
 habitacion=(await operar('crear_habitacion',d,k)).id
 assert.ok(habitacion>1)
 assert.equal((await operar('crear_habitacion',d,k)).id,habitacion)
 await assert.rejects(operar('crear_habitacion',{...d,numero:'203'},k),e=>e.code==='40001')
 await assert.rejects(operar('crear_habitacion',{...d,numero:'hab. 202'}),e=>e.code==='23505')
 await assert.rejects(operar('crear_habitacion',{...d,numero:'203',capacidad:0}),/capacidad/)
 cama=(await operar('crear_cama',{habitacionId:habitacion,numero:'Cama A'})).id
 assert.ok(cama>2)
 await assert.rejects(operar('crear_cama',{habitacionId:habitacion,numero:'a'}),e=>e.code==='23505')
 await assert.rejects(operar('crear_cama',{habitacionId:habitacion,numero:'B'}),e=>e.code==='23514')
 const c=await catalogo();assert.equal(c.habitaciones.find(h=>h.id===habitacion).numero,'202');assert.equal(c.camas.find(c=>c.id===cama).numero,'A')
})
test('versiones impiden sobreescribir cambios y la capacidad no baja de las camas habilitadas',async()=>{
 let h=(await catalogo()).habitaciones.find(h=>h.id===habitacion)
 await operar('editar_habitacion',{id:h.id,version:h.version,numero:'202',tipo:'Individual',capacidad:2})
 await assert.rejects(operar('editar_habitacion',{id:h.id,version:h.version,numero:'203',tipo:'General',capacidad:1}),e=>e.code==='40001')
 await operar('crear_cama',{habitacionId:habitacion,numero:'B'})
 h=(await catalogo()).habitaciones.find(h=>h.id===habitacion)
 await assert.rejects(operar('editar_habitacion',{id:h.id,version:h.version,numero:h.numero,tipo:h.tipo,capacidad:1}),e=>e.code==='23514')
})
test('baja temporal exige motivo, bloquea ingresos y habilitar conserva los límites',async()=>{
 let c=(await catalogo()).camas.find(c=>c.id===cama)
 await assert.rejects(operar('estado_cama',{id:c.id,version:c.version,habilitada:false,motivo:''}),/motivo/)
 await operar('estado_cama',{id:c.id,version:c.version,habilitada:false,motivo:'Mantenimiento'})
 await assert.rejects(como(1,tx=>tx.query("select clinica_hospital(null,$1)",[JSON.stringify({pacienteId:1,medicoId:1,camaId:cama,motivo:'Ingreso de prueba'})])),/fuera de servicio/)
 c=(await catalogo()).camas.find(c=>c.id===cama);assert.equal(c.habilitada,false)
 await operar('estado_cama',{id:c.id,version:c.version,habilitada:true})
 assert.equal((await catalogo()).camas.find(c=>c.id===cama).motivo,null)
})
test('camas ocupadas no admiten cambios de identificación ni baja; altas siguen siendo clínicas',async()=>{
 await como(1,tx=>tx.query("select clinica_hospital(null,$1)",[JSON.stringify({pacienteId:1,medicoId:1,camaId:cama,motivo:'Observación de prueba'})]))
 const {camas,habitaciones}=await catalogo(),c=camas.find(c=>c.id===cama),h=habitaciones.find(h=>h.id===habitacion)
 assert.equal(c.ocupada,true)
 await assert.rejects(operar('editar_cama',{id:c.id,version:c.version,numero:'Z'}),e=>e.code==='23514')
 await assert.rejects(operar('estado_cama',{id:c.id,version:c.version,habilitada:false,motivo:'Mantenimiento'}),e=>e.code==='23514')
 await assert.rejects(operar('estado_habitacion',{id:h.id,version:h.version,habilitada:false,motivo:'Reforma'}),e=>e.code==='23514')
 const i=(await db.query('select id from internaciones where cama_id=$1 and estado=\'activa\'',[cama])).rows[0].id
 await assert.rejects(como(1,tx=>tx.query('select clinica_hospital($1,$2)',[i,JSON.stringify({accion:'alta'})])),e=>e.code==='42501')
 const version=(await db.query('select actualizado_en from internaciones where id=$1',[i])).rows[0].actualizado_en
 await como(2,tx=>tx.query('select clinica_hospital($1,$2)',[i,JSON.stringify({accion:'alta',version,confirmado:true,notaAlta:'Alta de prueba con seguimiento'})]))
 const libre=(await catalogo()).camas.find(c=>c.id===cama)
 await operar('editar_cama',{id:cama,version:libre.version,numero:'Z'})
 assert.equal((await db.query('select ubicacion_registrada->>\'cama\' cama from internaciones where id=$1',[i])).rows[0].cama,'A')
})
test('baja de habitación es atómica y al reabrir se habilita cada cama; cambios auditados',async()=>{
 let h=(await catalogo()).habitaciones.find(h=>h.id===habitacion)
 await operar('estado_habitacion',{id:h.id,version:h.version,habilitada:false,motivo:'Reforma'})
 let cat=await catalogo();assert.ok(cat.camas.filter(c=>c.habitacionId===h.id).every(c=>!c.habilitada))
 await assert.rejects(operar('crear_cama',{habitacionId:h.id,numero:'C'}),/activas/)
 h=cat.habitaciones.find(x=>x.id===h.id)
 await operar('estado_habitacion',{id:h.id,version:h.version,habilitada:true})
 cat=await catalogo();assert.ok(cat.camas.filter(c=>c.habitacionId===h.id).every(c=>!c.habilitada))
 const audit=await db.query("select count(*)::int n from auditoria_clinica where tabla in('habitaciones','camas')")
 assert.ok(audit.rows[0].n>5)
})
test('una sesión administrativa bloqueada no consulta ni modifica el catálogo',async()=>{
 await como(1,tx=>tx.query("select clinica_estado_sesion('bloquear')"))
 await assert.rejects(catalogo(),e=>e.code==='42501')
 await assert.rejects(operar('crear_cama',{habitacionId:1,numero:'C'}),e=>e.code==='42501')
})

