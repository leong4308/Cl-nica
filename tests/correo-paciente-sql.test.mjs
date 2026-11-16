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
  await db.exec("update auth.users a set email=u.correo,email_confirmed_at=clock_timestamp() from usuarios u where u.auth_user_id=a.id")
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql','034_correo_paciente.sql']) await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'))
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}
async function servicio(fn){return db.transaction(async tx=>{await tx.exec('set local role service_role');return fn(tx)})}
const base={nombre:'Paciente actualizado',telefono:'5551234567',fechaNacimiento:'',genero:'',contactoEmergencia:'',telefonoEmergencia:''}
const editar=(n,p,correo,anterior,extra={})=>como(n,tx=>tx.query('select clinica_actualizar_paciente($1,$2)',[p,JSON.stringify({...base,correo,correoAnterior:anterior,...extra})]))
const preparar=async(correo,anterior,actor=uid(4))=>(await servicio(tx=>tx.query('select clinica_cambio_correo_preparar(1,$1,$2,$3) r',[actor,correo,anterior]))).rows[0].r
const validar=async(token)=>(await servicio(tx=>tx.query('select clinica_cambio_correo_validar($1) r',[token]))).rows[0].r
test('administración y recepción guardan el correo sin duplicar una ficha sin cuenta; invalida invitaciones anteriores',async()=>{
 const i=(await servicio(tx=>tx.query('select clinica_invitacion_preparar(2,$1) r',[uid(1)]))).rows[0].r
 await editar(1,2,'nuevo@test.local','otro@test.local')
 assert.equal((await db.query('select correo from usuarios where id=7')).rows[0].correo,'nuevo@test.local')
 assert.equal((await servicio(tx=>tx.query('select clinica_invitacion_validar($1) r',[i.token]))).rows[0].r,null)
 await editar(4,3,'tercero-nuevo@test.local','tercero@test.local')
 assert.equal((await db.query('select correo from usuarios where id=8')).rows[0].correo,'tercero-nuevo@test.local')
 assert.equal((await db.query('select count(*)::int n from perfiles_pacientes')).rows[0].n,3)
})
test('correo duplicado, inválido, versión anterior y rol ajeno no modifican la ficha',async()=>{
 await assert.rejects(editar(1,2,'paciente@test.local','nuevo@test.local'),e=>e.code==='23505')
 await assert.rejects(editar(1,2,'sin-arroba','nuevo@test.local'),/válido/)
 await assert.rejects(editar(1,2,'otro-nuevo@test.local','correo-viejo@test.local'),e=>e.code==='40001')
 for(const n of [2,5,6])await assert.rejects(editar(n,2,'ajeno@test.local','nuevo@test.local'),e=>e.code==='42501')
 await assert.rejects(editar(1,2,'revertido@test.local','nuevo@test.local',{nombre:''}),/personales/)
 assert.equal((await db.query('select correo from usuarios where id=7')).rows[0].correo,'nuevo@test.local')
 await assert.rejects(editar(1,1,'otro-nuevo@test.local','paciente@test.local'),/confirmación/)
})
test('registro incluye correo normalizado opcional y comprueba duplicados',async()=>{
 const r=(await como(4,tx=>tx.query('select clinica_registrar_paciente($1) r',[JSON.stringify({...base,nombre:'Paciente registrado',correo:'  REGISTRO@test.local  '})]))).rows[0].r
 assert.equal((await db.query('select u.correo from perfiles_pacientes p join usuarios u on u.id=p.usuario_id where p.id=$1',[r.id])).rows[0].correo,'registro@test.local')
 await assert.rejects(como(4,tx=>tx.query('select clinica_registrar_paciente($1)',[JSON.stringify({...base,correo:'REGISTRO@test.local'})])),e=>e.code==='23505')
 await assert.rejects(como(4,tx=>tx.query('select clinica_registrar_paciente($1)',[JSON.stringify({...base,correo:'incorrecto'})])),/válido/)
})
let cambio
test('una cuenta activa conserva su correo hasta confirmar y la solicitud no es accesible desde el navegador',async()=>{
 cambio=await preparar('acceso-nuevo@test.local','paciente@test.local')
 assert.equal((await db.query('select correo from usuarios where id=6')).rows[0].correo,'paciente@test.local')
 assert.equal((await db.query('select email from auth.users where id=$1',[uid(6)])).rows[0].email,'paciente@test.local')
 assert.equal((await validar(cambio.token)).correo,'acceso-nuevo@test.local')
 await assert.rejects(como(4,tx=>tx.query('select clinica_cambio_correo_preparar(1,$1,$2,$3)',[uid(4),'otro@test.local','paciente@test.local'])),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query('select * from paciente_correos_cambio')),e=>e.code==='42501')
 await assert.rejects(preparar('tercer@test.local','paciente@test.local',uid(2)),e=>e.code==='42501')
})
test('Auth y la ficha cambian juntos; una colisión revierte ambos y no altera citas ni contraseña',async()=>{
 const actualizar=token=>db.query('update auth.users set email=$1,raw_user_meta_data=$2 where id=$3',['acceso-nuevo@test.local',JSON.stringify({cn_cambio_correo:token}),uid(6)])
 await assert.rejects(actualizar('falso'),/confirmación vigente/)
 await db.exec("update usuarios set correo='acceso-nuevo@test.local' where id=7")
 await assert.rejects(actualizar(cambio.token),e=>e.code==='23505')
 assert.equal((await db.query('select email from auth.users where id=$1',[uid(6)])).rows[0].email,'paciente@test.local')
 assert.equal((await db.query('select correo from usuarios where id=6')).rows[0].correo,'paciente@test.local')
 await db.exec("update usuarios set correo='nuevo@test.local' where id=7")
 await actualizar(cambio.token)
 assert.equal((await db.query('select email from auth.users where id=$1',[uid(6)])).rows[0].email,'acceso-nuevo@test.local')
 assert.equal((await db.query('select correo from usuarios where id=6')).rows[0].correo,'acceso-nuevo@test.local')
 assert.equal((await validar(cambio.token)).confirmada,true)
 assert.equal((await db.query('select paciente_id from citas where id=100')).rows[0].paciente_id,1)
})
test('no se reutilizan tokens, las sesiones bloqueadas no editan y el cambio queda auditado',async()=>{
 await assert.rejects(db.query('update auth.users set email=$1 where id=$2',['otro@test.local',uid(6)]),/confirmación/)
 await como(1,tx=>tx.query("select clinica_estado_sesion('bloquear')"))
 await assert.rejects(editar(1,2,'otro-nuevo@test.local','nuevo@test.local'),e=>e.code==='42501')
 assert.ok((await db.query("select count(*)::int n from auditoria_clinica where accion='CONFIRMAR_CORREO'")).rows[0].n>0)
})
