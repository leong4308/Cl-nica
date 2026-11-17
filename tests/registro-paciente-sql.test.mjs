import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
let db,dia
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
before(async () => {
  db = new PGlite({ extensions: { btree_gist } })
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
  dia=(await db.query("select (clock_timestamp() at time zone 'America/Mexico_City')::date::text d")).rows[0].d
  // Únicamente en esta base PGlite: las llamadas al reloj de las migraciones usan un reloj controlado.
  // Los archivos SQL originales no se modifican ni se ejecuta esta sustitución en Supabase.
  await db.exec('create table reloj_aceptacion(instante timestamptz not null)')
  await db.query("insert into reloj_aceptacion values(($1::date+time '09:00') at time zone 'America/Mexico_City')",[dia])
  await db.exec('create function public.reloj_aceptacion() returns timestamptz language sql volatile security definer set search_path=public,pg_temp as $$select instante from reloj_aceptacion$$')
  await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8').replaceAll('clock_timestamp()', 'public.reloj_aceptacion()'))
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
  await db.exec("update usuarios set telefono='961-123-4567' where id=6;update usuarios set telefono='12345678901' where id=7")
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql','034_correo_paciente.sql','035_consultorios.sql','036_espera_y_controles.sql','037_comunicaciones_y_reportes.sql','038_datos_personales_paciente.sql','039_conflicto_perfil.sql','040_muestras_ambulatorias.sql','041_lectura_orden_insertada.sql','042_prorroga_consultorios.sql','043_registro_publico_paciente.sql','044_validacion_contactos.sql']) { try { await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8').replaceAll('clock_timestamp()', 'public.reloj_aceptacion()')) } catch(e){throw Error(nombre+': '+e.message+' '+(e.where??'')+' '+(e.position??''))} }
  await db.exec("revoke all on reloj_aceptacion from authenticated,anon;insert into catalogo_analisis(id,nombre) values(1,'Estudio de aceptación')")
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}



const persona={nombre:'Paciente de registro',telefono:'9611234567',fechaNacimiento:'1992-05-14',genero:'F',contactoEmergencia:'Contacto de prueba',telefonoEmergencia:'9617654321'}
async function insertar(n,datos,extra={}){
 return db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,clock_timestamp(),$3)',[uid(n),'registro'+n+'@test.local',JSON.stringify({nombre_completo:'Nombre externo',rol:'admin',puede_validar_laboratorio:true,...extra,cn_registro_paciente:datos})])
}
const rpc=async(n,func,args=[])=>(await como(n,tx=>tx.query('select '+func+' r',args))).rows[0].r

test('el registro crea usuario y ficha completos; los metadatos no conceden roles de personal',async()=>{
 await insertar(201,persona)
 const u=(await db.query('select * from usuarios where auth_user_id=$1',[uid(201)])).rows[0]
 assert.equal(u.rol,'paciente');assert.equal(u.puede_validar_laboratorio,false);assert.equal(u.nombre_completo,persona.nombre);assert.equal(u.telefono,persona.telefono)
 const p=(await db.query('select *,fecha_nacimiento::text nacimiento from perfiles_pacientes where usuario_id=$1',[u.id])).rows[0]
 assert.equal(p.nacimiento,persona.fechaNacimiento);assert.equal(p.genero,'F');assert.equal(p.nombre_contacto_emergencia,persona.contactoEmergencia);assert.equal(p.telefono_emergencia,persona.telefonoEmergencia)
 assert.equal((await db.query('select count(*)::int n from perfiles_medicos where usuario_id=$1',[u.id])).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int n from paciente_medicos where paciente_id=$1',[p.id])).rows[0].n,0)
 await db.query('insert into auth.sessions values($1,$1)',[uid(201)]);await rpc(201,'clinica_estado_sesion()')
 const portal=await rpc(201,'clinica_portal_paciente()');assert.equal(portal.perfil.id,p.id);assert.equal(portal.citas.length,0);assert.equal(portal.resultados.length,0)
 assert.equal((await como(201,tx=>tx.query('select id from perfiles_pacientes'))).rows.length,1)
 for(const funcion of ['clinica_medico_panel()','clinica_recepcion_panel()','clinica_enfermeria_panel()'])await assert.rejects(rpc(201,funcion),e=>e.code==='42501')
 const propio=await rpc(201,'clinica_mis_datos()');assert.equal(propio.telefono,persona.telefono);assert.equal(propio.contactoEmergencia,persona.contactoEmergencia)
 assert.ok((await db.query("select 1 from auditoria_clinica where autor=$1 and accion='AUTORREGISTRO'",[uid(201)])).rows.length)
})

test('la base exige todos los campos aunque se omita la validación del formulario',async()=>{
 let n=210
 for(const campo of Object.keys(persona)){
  const d={...persona};delete d[campo]
  await assert.rejects(insertar(n,d),e=>e.code==='23514')
  assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[uid(n)])).rows[0].n,0);n++
 }
 for(const d of [null,[],{}, {...persona,telefono:'123'}, {...persona,telefonoEmergencia:'1234567890123456'}, {...persona,genero:'X'}, {...persona,fechaNacimiento:'2100-01-01'}, {...persona,fechaNacimiento:'2025-02-30'}, {...persona,nombre:'A'}, {...persona,rol:'admin'}]){
  await assert.rejects(insertar(++n,d),e=>['23514','22008'].includes(e.code))
  assert.equal((await db.query('select count(*)::int n from usuarios where auth_user_id=$1',[uid(n)])).rows[0].n,0)
 }
})

test('un correo con ficha anterior no se vincula ni sobrescribe mediante autorregistro',async()=>{
 const anterior=(await db.query('select * from usuarios where id=8')).rows[0]
 await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[uid(240),anterior.correo,JSON.stringify({cn_registro_paciente:persona})]),e=>e.code==='23505')
 assert.deepEqual((await db.query('select * from usuarios where id=8')).rows[0],anterior)
})

test('la invitación anterior sigue activando la ficha existente sin crear otra',async()=>{
 const antes=(await db.query('select count(*)::int n from perfiles_pacientes')).rows[0].n
 const inv=(await db.query('select clinica_invitacion_preparar($1,$2) r',[3,uid(1)])).rows[0].r
 await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,clock_timestamp(),$3)',[uid(250),'tercero@test.local',JSON.stringify({cn_invitacion:inv.token,rol:'admin'})])
 assert.equal((await db.query('select count(*)::int n from perfiles_pacientes')).rows[0].n,antes)
 const u=(await db.query('select rol,auth_user_id from usuarios where id=8')).rows[0];assert.equal(u.rol,'paciente');assert.equal(u.auth_user_id,uid(250))
})

test('la creación administrativa de personal sigue disponible y el registro directo incompleto no abre el portal',async()=>{
 await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,clock_timestamp(),$3)',[uid(260),'personal@test.local',JSON.stringify({nombre_completo:'Personal de prueba',rol:'admin'})])
 const u=(await db.query('select id,rol from usuarios where auth_user_id=$1',[uid(260)])).rows[0]
 assert.equal(u.rol,'paciente');assert.equal((await db.query('select count(*)::int n from perfiles_pacientes where usuario_id=$1',[u.id])).rows[0].n,0)
 await db.query('insert into auth.sessions values($1,$1)',[uid(260)]);await rpc(260,'clinica_estado_sesion()')
 await assert.rejects(rpc(260,'clinica_portal_paciente()'))
 // La API administrativa usa servicio después de verificar al administrador, nunca metadatos públicos.
 await db.query("update usuarios set rol='medico' where id=$1",[u.id]);assert.equal((await db.query('select rol from usuarios where id=$1',[u.id])).rows[0].rol,'medico')
})

test('el endpoint puede consultar disponibilidad sin exponer tablas y el trigger no es una RPC pública',async()=>{
 const r=await db.transaction(async tx=>{await tx.exec('set local role anon');return tx.query('select clinica_registro_habilitado() ok')});assert.equal(r.rows[0].ok,true)
 await assert.rejects(como(201,tx=>tx.query('select clinica_ficha_autoregistro()')),e=>e.code==='42501')
 assert.equal((await db.query('select clinica_version() v')).rows[0].v,44)
})

test('normaliza separadores sin cambiar números y conserva datos históricos ajenos a una edición',async()=>{
 assert.equal((await db.query('select telefono from usuarios where id=6')).rows[0].telefono,'9611234567')
 assert.equal((await db.query('select telefono from usuarios where id=7')).rows[0].telefono,'12345678901')
 await db.exec('update usuarios set correo_citas=false where id=7')
 assert.equal((await db.query('select telefono from usuarios where id=7')).rows[0].telefono,'12345678901')
 await assert.rejects(db.exec("update usuarios set telefono='123456789012' where id=7"),e=>e.code==='23514')
})

test('la base rechaza contactos inválidos también en escrituras directas y conserva nombres con acentos',async()=>{
 await insertar(301,persona)
 const u=(await db.query('select id from usuarios where auth_user_id=$1',[uid(301)])).rows[0].id
 for(const nombre of ['María-José López',"Ana O'Connor",'Dr. Jorge Méndez','Jose\u0301 Pérez']) await db.query('update usuarios set nombre_completo=$1 where id=$2',[nombre,u])
 for(const [campo,valor] of [['telefono','123456789'],['telefono','12345678901'],['telefono','961-123-4567'],['telefono','+529611234567'],['nombre_completo','Ana123'],['nombre_completo','Ana\nLópez'],['nombre_completo','--'],['correo','sin-correo'],['correo','a'.repeat(150)+'@test.local']]) await assert.rejects(db.query(`update usuarios set ${campo}=$1 where id=$2`,[valor,u]),e=>e.code===(campo==='correo' && valor.length>150?'22001':'23514'))
 for(const [campo,valor] of [['telefono_emergencia','123'],['telefono_emergencia','961-123-4567'],['telefono_emergencia',null],['nombre_contacto_emergencia',''],['nombre_contacto_emergencia','Contacto123'],['fecha_nacimiento','1899-12-31'],['fecha_nacimiento','2100-01-01'],['notas_medicas','a'.repeat(8001)]]) await assert.rejects(db.query(`update perfiles_pacientes set ${campo}=$1 where usuario_id=$2`,[valor,u]),e=>e.code==='23514')
 await db.query('update perfiles_pacientes set nombre_contacto_emergencia=null,telefono_emergencia=null where usuario_id=$1',[u])
 await db.query("update usuarios set telefono='0123456789' where id=$1",[u])
 assert.equal((await db.query('select telefono from usuarios where id=$1',[u])).rows[0].telefono,'0123456789')
})

test('un autorregistro con número internacional o nombre inválido se revierte por completo',async()=>{
 let id=310
 for(const cambio of [{telefono:'96112345678'},{telefono:'961-123-4567'},{nombre:'Paciente123'},{contactoEmergencia:'Contacto123'},{telefonoEmergencia:'+529611234567'}]) {
  id++;await assert.rejects(insertar(id,{...persona,...cambio}),e=>e.code==='23514')
  assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[uid(id)])).rows[0].n,0)
 }
})
