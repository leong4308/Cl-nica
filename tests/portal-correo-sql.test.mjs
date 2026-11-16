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
    insert into auth.users(id) values('${uid(1)}'),('${uid(2)}'),('${uid(3)}'),('${uid(4)}'),('${uid(5)}'),('${uid(6)}');
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
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql']) await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'))
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}
async function servicio(fn){return db.transaction(async tx=>{await tx.exec('set local role service_role');return fn(tx)})}
const preparar=async(p=2,actor=uid(4))=>(await servicio(tx=>tx.query('select clinica_invitacion_preparar($1,$2) r',[p,actor]))).rows[0].r
const validar=async(token)=>(await servicio(tx=>tx.query('select clinica_invitacion_validar($1) r',[token]))).rows[0].r
const reserva=uid(9000)
const operar=async(op,d={})=>(await servicio(tx=>tx.query('select clinica_correo_operar($1,$2,$3) r',[reserva,op,JSON.stringify(d)]))).rows[0].r
let invitacion
test('solo el servidor prepara invitaciones con un actor administrativo activo',async()=>{
 await assert.rejects(como(1,tx=>tx.query('select clinica_invitacion_preparar(2,$1)',[uid(1)])),e=>e.code==='42501')
 await assert.rejects(preparar(2,uid(2)),e=>e.code==='42501')
 await assert.rejects(preparar(1),e=>e.code==='23505')
 invitacion=await preparar();assert.match(invitacion.token,/^[a-f0-9]{64}$/)
 await assert.rejects(preparar(),/un minuto/)
 assert.equal((await validar(invitacion.token)).correo,'otro@test.local')
 assert.equal(await validar('falso'),null)
 await assert.rejects(como(6,tx=>tx.query('select * from portal_invitaciones')),e=>e.code==='42501')
})
test('la activación conserva ficha, relaciones e historial y no confía en roles públicos',async()=>{
 const antes=(await db.query('select count(*)::int n from perfiles_pacientes')).rows[0].n
 await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,clock_timestamp(),$3)',[uid(7001),'otro@test.local',JSON.stringify({cn_invitacion:invitacion.token,rol:'admin'})])
 const u=(await db.query('select * from usuarios where id=7')).rows[0]
 assert.equal(u.auth_user_id,uid(7001));assert.equal(u.rol,'paciente')
 assert.equal((await db.query('select count(*)::int n from perfiles_pacientes')).rows[0].n,antes)
 assert.equal((await db.query('select usuario_id from perfiles_pacientes where id=2')).rows[0].usuario_id,7)
 assert.equal((await db.query('select paciente_id from citas where id=101')).rows[0].paciente_id,2)
 assert.equal((await validar(invitacion.token)).activada,true)
 await assert.rejects(db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,clock_timestamp(),$3)',[uid(7002),'intruso@test.local',JSON.stringify({cn_invitacion:invitacion.token})]),/invitación/)
 await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[uid(7003),'registro@test.local',JSON.stringify({rol:'admin'})])
 assert.equal((await db.query('select rol from usuarios where auth_user_id=$1',[uid(7003)])).rows[0].rol,'paciente')
})
test('correo cambiado, invitación expirada y otro destinatario no activan la ficha',async()=>{
 const i=await preparar(3)
 await assert.rejects(db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,clock_timestamp(),$3)',[uid(7004),'ajeno@test.local',JSON.stringify({cn_invitacion:i.token})]),/invitación/)
 await db.query("update usuarios set correo='nuevo@test.local' where id=8")
 assert.equal(await validar(i.token),null)
 await db.query("update usuarios set correo='tercero@test.local' where id=8")
 await db.query("update portal_invitaciones set vence_en=clock_timestamp()-interval '1 second' where id=$1",[i.id])
 assert.equal(await validar(i.token),null)
})
test('nuevas citas encolan un correo solo al paciente con dirección verificada',async()=>{
 await db.query("update auth.users set email='paciente@test.local',email_confirmed_at=clock_timestamp() where id=$1",[uid(6)])
 await db.exec("insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin) values(300,1,1,1,clock_timestamp()+interval '8 hours',clock_timestamp()+interval '8 hours 20 minutes')")
 const envios=await db.query('select e.*,n.usuario_id from correo_envios e join notificaciones n on n.id=e.notificacion_id where n.cita_id=300')
 assert.equal(envios.rows.length,1);assert.equal(envios.rows[0].correo,'paciente@test.local');assert.equal(envios.rows[0].usuario_id,6)
 await assert.rejects(como(6,tx=>tx.query('select * from correo_envios')),e=>e.code==='42501')
 const tomados=await operar('reclamar');assert.equal(tomados.length,1)
 assert.deepEqual(await operar('reclamar'),[])
 const e=tomados[0],d={id:e.id,arrendamiento:e.arrendamiento}
 assert.equal((await operar('vigente',d)).cita.id,300)
 assert.equal(await operar('vigente',{...d,arrendamiento:uid(9999)}),null)
 await operar('enviado',{...d,proveedorId:'prueba'})
 assert.equal((await db.query('select estado from correo_envios where id=$1',[e.id])).rows[0].estado,'enviado')
})
test('preferencias, cambios de horario y correos sin verificar evitan avisos desactualizados',async()=>{
 await db.exec("insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin) values(301,1,1,1,clock_timestamp()+interval '9 hours',clock_timestamp()+interval '9 hours 20 minutes')")
 let [e]=await operar('reclamar'),d={id:e.id,arrendamiento:e.arrendamiento}
 await como(6,tx=>tx.query('select clinica_preferencias_correo(false)'))
 assert.equal(await operar('vigente',d),null);await operar('omitir',d)
 await db.exec("update citas set estado='confirmada' where id=301")
 assert.deepEqual(await operar('reclamar'),[])
 await como(6,tx=>tx.query('select clinica_preferencias_correo(true)'))
 await db.exec("update citas set inicio=inicio+interval '30 minutes',fin=fin+interval '30 minutes' where id=301")
 ;[e]=await operar('reclamar');d={id:e.id,arrendamiento:e.arrendamiento}
 await db.exec("update citas set estado='cancelada_paciente' where id=301")
 assert.equal(await operar('vigente',d),null)
 await operar('omitir',d)
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[uid(6)])
 const tomados=await operar('reclamar')
 for(const t of tomados)assert.equal(await operar('vigente',{id:t.id,arrendamiento:t.arrendamiento}),null)
})
test('reintentos de correo están limitados y las RPC privadas no están disponibles al navegador',async()=>{
 await assert.rejects(como(1,tx=>tx.query('select clinica_correo_operar($1,$2,$3)',[reserva,'reclamar','{}'])),e=>e.code==='42501')
 await assert.rejects(operar('sql',{sql:'delete from usuarios'}),/inválida/)
 const [e]=(await db.query("select id,arrendamiento from correo_envios where estado='enviando' order by id desc limit 1")).rows
 if(e){await operar('error',{...e,codigo:'HTTP_403',permanente:true});assert.equal((await db.query('select estado from correo_envios where id=$1',[e.id])).rows[0].estado,'fallido')}
})
test('la ventana de treinta minutos también genera correo y las colas antiguas se descartan',async()=>{
 await db.query('update auth.users set email_confirmed_at=clock_timestamp() where id=$1',[uid(6)])
 await db.exec("insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin) values(302,1,1,1,clock_timestamp()+interval '20 minutes',clock_timestamp()+interval '40 minutes');select clinica_generar_recordatorios()")
 assert.equal((await db.query("select count(*)::int n from correo_envios e join notificaciones n on n.id=e.notificacion_id where n.cita_id=302 and n.tipo='recordatorio_30m'")).rows[0].n,1)
 await db.exec("update notificaciones set creado_en=clock_timestamp()-interval '25 hours' where cita_id=302")
 await operar('reclamar')
 assert.ok((await db.query("select e.estado from correo_envios e join notificaciones n on n.id=e.notificacion_id where n.cita_id=302")).rows.every(e=>e.estado==='omitido'))
})

