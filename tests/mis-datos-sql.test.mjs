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
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
  await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'))
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated; grant usage,select on all sequences in schema public to authenticated;
    insert into auth.users(id) values('${uid(1)}'),('${uid(2)}'),('${uid(3)}'),('${uid(4)}'),('${uid(5)}'),('${uid(6)}'),('${uid(7)}');
    insert into usuarios(id,auth_user_id,correo,nombre_completo,rol) values
      (1,'${uid(1)}','admin@test.local','Admin','admin'),(2,'${uid(2)}','ana@test.local','Ana','medico'),(3,'${uid(3)}','jorge@test.local','Jorge','medico'),
      (4,'${uid(4)}','recepcion@test.local','Recepción','recepcionista'),(5,'${uid(5)}','enfermeria@test.local','Enfermería','enfermero'),
      (6,'${uid(6)}','paciente@test.local','Paciente uno','paciente'),(7,'${uid(7)}','otro@test.local','Paciente dos','paciente'),(8,null,'tercero@test.local','Paciente tres','paciente');
    insert into clinicas(id,nombre) values(1,'Clínica');
    insert into perfiles_medicos(id,usuario_id,clinica_id,especialidad,cedula_profesional) values(1,2,1,'General','A'),(2,3,1,'General','B');
    insert into perfiles_pacientes(id,usuario_id) values(1,6),(2,7),(3,8);
    insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin,estado) values(100,1,1,1,'2026-01-01 10:00Z','2026-01-01 10:20Z','atendida'),(101,2,2,1,'2026-01-02 10:00Z','2026-01-02 10:20Z','atendida');
    insert into expedientes(id,cita_id,diagnostico) values(100,100,'Nota de prueba'),(101,101,'Otra nota');
    insert into habitaciones(id,clinica_id,numero,tipo,capacidad) values(1,1,'101','General',2);
    insert into camas(id,habitacion_id,numero) values(1,1,'A'),(2,1,'B');`)
  await db.exec("insert into perfiles_enfermeros(id,usuario_id,clinica_id) values(1,5,1); insert into auth.sessions select id,id from auth.users")
  for(const tabla of ['usuarios','perfiles_pacientes']) await db.exec(`select setval(pg_get_serial_sequence('${tabla}','id'),(select max(id) from ${tabla}))`)
  await db.exec("update auth.users a set email=u.correo,email_confirmed_at=clock_timestamp() from usuarios u where u.auth_user_id=a.id")
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql','034_correo_paciente.sql','035_consultorios.sql','036_espera_y_controles.sql','037_comunicaciones_y_reportes.sql','038_datos_personales_paciente.sql','039_conflicto_perfil.sql']) { try { await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8')) } catch(e){throw Error(nombre+': '+e.message+' '+(e.where??'')+' '+(e.position??''))} }
  await db.exec("update perfiles_pacientes set fecha_nacimiento='1992-05-14',genero='F',notas_medicas='Dato clínico protegido' where id=1")
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}

const leer=async(n)=>(await como(n,tx=>tx.query('select clinica_mis_datos() r'))).rows[0].r
const datos={nombre:'Paciente actualizado',telefono:'9611234567',fechaNacimiento:'1992-05-15',genero:'F',contactoEmergencia:'Contacto de prueba',telefonoEmergencia:'9617654321'}
const guardar=async(n,d,v)=>(await como(n,tx=>tx.query('select clinica_guardar_mis_datos($1,$2) r',[JSON.stringify(d),v]))).rows[0].r

test('mis datos deriva al paciente de su sesión; personal y anónimos no acceden a esta función',async()=>{
 assert.equal((await db.query('select clinica_version() v')).rows[0].v,39)
 const p=await leer(6);assert.equal(p.fechaNacimiento,'1992-05-14');assert.match(p.version,/^[a-f0-9]{32}$/)
 assert.ok(!('notas_medicas' in p));assert.ok(!('pacienteId' in p))
 for(const n of [1,2,4,5])await assert.rejects(leer(n),e=>e.code==='42501')
 await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select clinica_mis_datos()')}),e=>e.code==='42501')
})

test('paciente guarda todos sus datos personales en una transacción sin alterar otra ficha ni su información clínica',async()=>{
 const antes=(await db.query('select to_jsonb(p) p from perfiles_pacientes p where id=2')).rows[0].p
 const uAntes=(await db.query('select auth_user_id,correo,rol,esta_activo from usuarios where id=6')).rows[0]
 const v=(await leer(6)).version,r=await guardar(6,datos,v)
 assert.equal(r.ok,true);assert.equal(r.paciente.contactoEmergencia,datos.contactoEmergencia);assert.notEqual(r.paciente.version,v)
 assert.deepEqual((await db.query('select to_jsonb(p) p from perfiles_pacientes p where id=2')).rows[0].p,antes)
 assert.deepEqual((await db.query('select auth_user_id,correo,rol,esta_activo from usuarios where id=6')).rows[0],uAntes)
 assert.equal((await db.query('select notas_medicas from perfiles_pacientes where id=1')).rows[0].notas_medicas,'Dato clínico protegido')
 const portal=(await como(6,tx=>tx.query('select clinica_portal_paciente() r'))).rows[0].r
 assert.equal(portal.perfil.contacto_emergencia,datos.contactoEmergencia)
 assert.equal(portal.perfil.telefono_emergencia,datos.telefonoEmergencia)
 const a=await db.query("select autor,tabla from auditoria_clinica where autor=$1 and tabla in('usuarios','perfiles_pacientes')",[uid(6)]);assert.ok(a.rows.some(x=>x.tabla==='perfiles_pacientes'))
})

test('rechaza escrituras sobre correo, rol, otra ficha o notas, incluso por RPC directo',async()=>{
 for(const protegido of [{pacienteId:2},{usuario_id:7},{correo:'otro@test.local'},{rol:'admin'},{notas_medicas:'Falso'}])await assert.rejects(guardar(6,{...datos,...protegido},(await leer(6)).version),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query('select clinica_datos_personales(2)')),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query("update perfiles_pacientes set nombre_contacto_emergencia='Intrusión' where id=2")),e=>e.code==='42501')
})

test('valida nacimiento, género y teléfonos sin guardar parcialmente el nombre',async()=>{
 const original=await leer(6),nombre=(await db.query('select nombre_completo from usuarios where id=6')).rows[0].nombre_completo
 const futuro=(await db.query("select ((clock_timestamp() at time zone 'America/Mexico_City')::date+1)::text f")).rows[0].f
 for(const invalido of [{fechaNacimiento:futuro},{fechaNacimiento:'2026-02-30'},{genero:'Z'},{telefonoEmergencia:'texto'},{contactoEmergencia:'x'.repeat(201)}])await assert.rejects(guardar(6,{...datos,nombre:'NO guardar',...invalido},original.version))
 assert.equal((await db.query('select nombre_completo from usuarios where id=6')).rows[0].nombre_completo,nombre);assert.deepEqual(await leer(6),original)
})

test('una edición de recepción invalida el formulario antiguo sin sobrescribirla',async()=>{
 const v=(await leer(6)).version
 await db.exec("update perfiles_pacientes set telefono_emergencia='5551234567' where id=1")
 await assert.rejects(guardar(6,datos,v),e=>e.code==='PT409')
 assert.equal((await leer(6)).telefonoEmergencia,'5551234567')
})

test('los campos opcionales se pueden limpiar y volver a guardar sin alterar identificadores',async()=>{
 const r=await guardar(6,{...datos,fechaNacimiento:'',genero:'',contactoEmergencia:'',telefonoEmergencia:''},(await leer(6)).version)
 assert.equal(r.paciente.fechaNacimiento,'');assert.equal(r.paciente.genero,'');assert.equal(r.paciente.telefonoEmergencia,'')
 const id=(await db.query('select id,usuario_id from perfiles_pacientes where id=1')).rows[0];assert.deepEqual(id,{id:1,usuario_id:6})
})

test('sesión bloqueada, paciente inactivo y sesión ajena no guardan datos',async()=>{
 await db.exec("update sesiones_clinica set bloqueada_en=clock_timestamp() where auth_user_id='"+uid(6)+"'")
 await assert.rejects(leer(6),e=>e.code==='42501')
 await assert.rejects(guardar(6,datos,'a'.repeat(32)),e=>e.code==='42501')
 await db.exec("update sesiones_clinica set bloqueada_en=null where auth_user_id='"+uid(6)+"'")
 await assert.rejects(como(6,tx=>tx.query('select clinica_mis_datos()'),uid(99)),e=>e.code==='42501')
 await db.exec('update perfiles_pacientes set esta_activo=false where id=1')
 await assert.rejects(leer(6),e=>e.code==='42501')
 await assert.rejects(guardar(6,datos,'a'.repeat(32)),e=>e.code==='42501')
})
