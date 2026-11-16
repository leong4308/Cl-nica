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
  await db.exec("insert into auth.sessions select id,id from auth.users")
  for(const tabla of ['usuarios','perfiles_pacientes']) await db.exec(`select setval(pg_get_serial_sequence('${tabla}','id'),(select max(id) from ${tabla}))`)
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql']) await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'))
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

test('el instalador reconoce el SQL ejecutado manualmente y rechaza registrar otro contenido como aplicado',async()=>{
 const sql=readFileSync(new URL('../supabase/migraciones/024_respuestas_citas.sql',import.meta.url),'utf8')
 assert.equal(await respuestasInstaladasManualmente(db,sql),true)
 assert.equal(await respuestasInstaladasManualmente(db,sql.replace('select 24','select 999')),false)
 assert.equal(await respuestasInstaladasManualmente(db,readFileSync(new URL('../supabase/migraciones/025_telegram_https.sql',import.meta.url),'utf8')),true)
 assert.equal(await respuestasInstaladasManualmente(db,readFileSync(new URL('../supabase/migraciones/026_reagenda_turnos.sql',import.meta.url),'utf8')),true)
})

test('el trabajador HTTPS exige privilegios de servicio y reserva exclusiva; no acepta SQL como operación',async()=>{
 const sql=readFileSync(new URL('../supabase/migraciones/025_telegram_https.sql',import.meta.url),'utf8')
 assert.deepEqual([...sql.matchAll(/when '([a-zA-Z]+)' then v_sql/g)].map(m=>m[1]).sort(),Object.keys(CONSULTAS_TELEGRAM).filter(k=>!['turnosCita','reagendarTurno','iniciarReserva','horasReserva','resumenReserva','confirmarReserva','respuestaEspera'].includes(k)).sort())
 await assert.rejects(como(1,tx=>tx.query('select clinica_reservar_trabajador($1)',[reservaBot])),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query("select clinica_operar_telegram($1,'control')",[reservaBot])),e=>e.code==='42501')
 const otra='12345678-1234-4234-8234-123456789099'
 assert.equal((await db.query('select clinica_reservar_trabajador($1) r',[otra])).rows[0].r,false)
 await assert.rejects(db.query("select clinica_operar_telegram($1,'select * from usuarios')",[reservaBot]),e=>e.code==='42501')
 await db.exec("update telegram_trabajador set vence_en=clock_timestamp()-interval '1 second' where id=1")
 await assert.rejects(db.query("select clinica_operar_telegram($1,'control')",[reservaBot]),e=>e.code==='55000')
 assert.equal((await db.query('select clinica_reservar_trabajador($1) r',[otra])).rows[0].r,true)
 assert.equal((await db.query('select clinica_reservar_trabajador($1,true) r',[reservaBot])).rows[0].r,false)
 await db.query('select clinica_reservar_trabajador($1,true)',[otra])
 assert.equal((await db.query('select clinica_reservar_trabajador($1) r',[reservaBot])).rows[0].r,true)
})
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

let citaAviso
test('una cita avisa a su paciente, médico y recepción; cada cuenta solo lee y marca sus avisos', async () => {
 citaAviso=(await como(4,tx=>tx.query('select clinica_crear_cita(3,1,$1,$2) r',['2038-05-01T16:00:00Z','Prueba de avisos']))).rows[0].r.id
 const usuarios=(await db.query('select usuario_id from notificaciones where cita_id=$1 order by usuario_id',[citaAviso])).rows.map(r=>r.usuario_id)
 assert.deepEqual(usuarios,[1,2,4,8])
 const propios=(await como(2,tx=>tx.query('select * from notificaciones where cita_id=$1',[citaAviso]))).rows
 assert.equal(propios.length,1);assert.equal(propios[0].usuario_id,2)
 assert.equal((await como(3,tx=>tx.query('select * from notificaciones where cita_id=$1',[citaAviso]))).rows.length,0)
 await assert.rejects(como(2,tx=>tx.query("update notificaciones set mensaje='Falso' where id=$1",[propios[0].id])),e=>e.code==='42501')
 await como(2,tx=>tx.query('update notificaciones set leida_en=clock_timestamp() where id=$1',[propios[0].id]))
 assert.ok((await db.query('select leida_en from notificaciones where id=$1',[propios[0].id])).rows[0].leida_en)
 await assert.rejects(como(2,tx=>tx.query('select * from telegram_cuentas')),e=>e.code==='42501')
 await assert.rejects(como(2,tx=>tx.query('select clinica_generar_recordatorios()')),e=>e.code==='42501')
})

test('recordatorios de 24 y 2 horas son únicos y una cancelación impide nuevos recordatorios',async()=>{
 assert.equal((await db.query('select clinica_generar_recordatorios($1) n',['2038-04-30T17:00:00Z'])).rows[0].n,2)
 assert.equal((await db.query('select clinica_generar_recordatorios($1) n',['2038-04-30T17:00:00Z'])).rows[0].n,0)
 assert.equal((await db.query('select clinica_generar_recordatorios($1) n',['2038-05-01T14:30:00Z'])).rows[0].n,2)
 await como(4,tx=>tx.query("update citas set estado='cancelada_paciente' where id=$1",[citaAviso]))
 assert.equal((await db.query('select clinica_generar_recordatorios($1) n',['2038-05-01T14:45:00Z'])).rows[0].n,0)
})

test('Telegram exige un enlace válido y confirmación en el portal; ignora grupos y enlaces usados',async()=>{
 const token='a'.repeat(43),hash=hashVinculo(token)
 const v=(await db.query("insert into telegram_vinculos(usuario_id,token_hash,vence_en) values(8,$1,clock_timestamp()+interval '10 minutes') returning id",[hash])).rows[0]
 const capturas=[],fetcher=async(url,req)=>{capturas.push(JSON.parse(req.body));return{ok:true,json:async()=>({ok:true,result:{}})}}
 const update={update_id:100,message:{chat:{type:'private',id:777},from:{id:777,first_name:'Prueba'},text:'/start '+token}}
 await procesarActualizaciones(dbBot,'simulado',[{...update,message:{...update.message,chat:{type:'group',id:-77}}}],fetcher)
 assert.equal((await db.query('select chat_id from telegram_vinculos where id=$1',[v.id])).rows[0].chat_id,null)
 await procesarActualizaciones(dbBot,'simulado',[{...update,update_id:101}],fetcher)
 assert.equal((await db.query('select count(*)::int n from telegram_cuentas where usuario_id=8')).rows[0].n,0)
 await assert.rejects(como(2,tx=>tx.query('select clinica_confirmar_telegram(8,$1)',[v.id])),e=>e.code==='42501')
 assert.equal((await db.query('select clinica_confirmar_telegram(7,$1) r',[v.id])).rows[0].r,false)
 assert.equal((await db.query('select clinica_confirmar_telegram(8,$1) r',[v.id])).rows[0].r,true)
 assert.equal((await db.query('select clinica_confirmar_telegram(8,$1) r',[v.id])).rows[0].r,false)
 assert.equal((await db.query('select chat_id from telegram_cuentas where usuario_id=8')).rows[0].chat_id,777)
 assert.ok(capturas.every(c=>!c.text.includes('Paciente uno')))
})

test('la cola omite recordatorios cancelados, reintenta errores y respeta /stop',async()=>{
 await db.query('insert into telegram_envios(notificacion_id) select id from notificaciones where cita_id=$1 and usuario_id=8 on conflict do nothing',[citaAviso])
 const valido=(await db.query("insert into notificaciones(usuario_id,tipo,titulo,mensaje,clave) values(8,'prueba','Aviso','Mensaje sin datos clínicos','prueba-cola') returning id")).rows[0].id
 const llamadas=[],fetcher=async(url,req)=>{llamadas.push(JSON.parse(req.body));return{ok:false,status:429,json:async()=>({ok:false,error_code:429,parameters:{retry_after:60}})}}
 assert.equal(await entregarPendientes(dbBot,'simulado',fetcher),0)
 const fallido=(await db.query('select estado,intentos from telegram_envios where notificacion_id=$1',[valido])).rows[0]
 assert.deepEqual(fallido,{estado:'pendiente',intentos:1})
 assert.equal(llamadas.length,2) // La cancelación y el aviso general; los recordatorios vencidos se omiten.
 const stale=(await db.query("select count(*)::int n from telegram_envios e join notificaciones n on n.id=e.notificacion_id where n.tipo like 'recordatorio_%' and e.estado='omitido'")).rows[0].n
 assert.ok(stale>=2)
 const ok=async()=>({ok:true,json:async()=>({ok:true,result:{}})})
 await procesarActualizaciones(dbBot,'simulado',[{update_id:102,message:{chat:{type:'private',id:777},from:{id:777},text:'/stop'}}],ok)
 assert.equal((await db.query('select activo from telegram_cuentas where usuario_id=8')).rows[0].activo,false)
 await db.query("update telegram_envios set proximo_intento=clock_timestamp() where estado='pendiente'")
 assert.equal(await entregarPendientes(dbBot,'simulado',ok),0)
})

test('desvincular libera el chat para otra cuenta y no entrega avisos de citas eliminadas',async()=>{
 const v=(await db.query("insert into telegram_vinculos(usuario_id,token_hash,vence_en,chat_id,nombre) values(7,$1,clock_timestamp()+interval '10 minutes',777,'Otra cuenta') returning id",[hashVinculo('b'.repeat(43))])).rows[0]
 assert.equal((await db.query('select clinica_confirmar_telegram(7,$1) r',[v.id])).rows[0].r,true)
 const incompatible=(await db.query("insert into telegram_vinculos(usuario_id,token_hash,vence_en,chat_id,nombre) values(8,$1,clock_timestamp()+interval '10 minutes',777,'Cuenta ocupada') returning id",[hashVinculo('c'.repeat(43))])).rows[0]
 await assert.rejects(db.query('select clinica_confirmar_telegram(8,$1)',[incompatible.id]),e=>e.code==='23505')
 const n=(await db.query("insert into notificaciones(usuario_id,tipo,titulo,mensaje,cita_inicio,clave) values(7,'cita_reprogramada','Cita eliminada','Este aviso no debe enviarse',clock_timestamp()+interval '2 hours','eliminada-prueba') returning id")).rows[0].id
 const llamadas=[]
 await entregarPendientes(dbBot,'simulado',async(url,req)=>{llamadas.push(JSON.parse(req.body));return{ok:true,json:async()=>({ok:true,result:{}})}})
 assert.ok(llamadas.every(m=>!m.text.includes('Este aviso no debe enviarse')))
 assert.equal((await db.query('select estado from telegram_envios where notificacion_id=$1',[n])).rows[0].estado,'omitido')
})

test('el portal del paciente solo devuelve sus citas y consultas, y no permite leer catálogos internos',async()=>{
 const portal=(await como(6,tx=>tx.query('select clinica_portal_paciente() datos'))).rows[0].datos
 assert.equal(portal.perfil.id,1);assert.equal(portal.perfil.nombre,'Paciente uno')
 assert.ok(portal.citas.every(c=>c.id===100));assert.equal(portal.consultas.length,1)
 assert.equal(portal.consultas[0].diagnostico,'Nota de prueba')
 assert.ok(!Object.hasOwn(portal.consultas[0],'notas_doctor'))
 for(const tabla of ['camas','habitaciones','perfiles_medicos','perfiles_enfermeros','clinicas','catalogo_analisis'])assert.equal((await como(6,tx=>tx.query('select * from '+tabla))).rows.length,0)
 assert.equal((await como(1,tx=>tx.query('select * from camas'))).rows.length,2)
 await assert.rejects(como(2,tx=>tx.query('select clinica_portal_paciente()')),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query("select clinica_auditar_documento('expedientes',100,'ADJUNTAR_DOCUMENTO','falso.pdf')")),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query("select clinica_auditar_documento('expedientes',101,'ABRIR_DOCUMENTO','ajeno.pdf')")),e=>e.code==='42501')
 await como(6,tx=>tx.query("select clinica_auditar_documento('expedientes',100,'ABRIR_DOCUMENTO','propio.pdf')"))
})

test('el paciente solo recibe resultados publicados y el cambio de laboratorio produce su aviso',async()=>{
 const id=(await como(1,tx=>tx.query('select clinica_hospital(null,$1) r',[JSON.stringify({pacienteId:1,medicoId:1,camaId:2,motivo:'Prueba de resultados'})]))).rows[0].r.id
 const episodio=(await db.query('select id from episodios_medicos where internacion_id=$1 order by id limit 1',[id])).rows[0].id
 const orden=(await db.query("insert into ordenes_medicas(episodio_id,tipo_orden,descripcion) values($1,'analisis','Estudio de prueba') returning id",[episodio])).rows[0].id
 const analisis=(await db.query("insert into catalogo_analisis(nombre) values('Estudio privado') returning id")).rows[0].id
 const solicitud=(await db.query("insert into solicitudes_analisis(orden_medica_id,analisis_id,resultado) values($1,$2,'Borrador no publicado') returning id",[orden,analisis])).rows[0].id
 const antes=(await como(6,tx=>tx.query('select clinica_portal_paciente() r'))).rows[0].r.resultados
 assert.equal(antes[0].resultado,null);assert.equal(antes[0].con_documento,false)
 assert.equal((await como(6,tx=>tx.query('select resultado from solicitudes_analisis where id=$1',[solicitud]))).rows.length,0)
 await assert.rejects(como(6,tx=>tx.query("select clinica_auditar_documento('laboratorio',$1,'ABRIR_DOCUMENTO','borrador.pdf')",[solicitud])),e=>e.code==='42501')
 await db.query("update solicitudes_analisis set estado_analisis='completado',resultado='Resultado publicado',archivo_resultado=$2 where id=$1",[solicitud,solicitud+'/resultado.pdf'])
 const despues=(await como(6,tx=>tx.query('select clinica_portal_paciente() r'))).rows[0].r.resultados
 assert.equal(despues[0].resultado,'Resultado publicado');assert.equal(despues[0].con_documento,true)
 assert.equal((await como(6,tx=>tx.query('select resultado from solicitudes_analisis where id=$1',[solicitud]))).rows[0].resultado,'Resultado publicado')
 assert.ok((await db.query("select id from notificaciones where usuario_id=6 and titulo='Resultado de laboratorio disponible'")).rows.length)
})

let citaRespuesta, versionRespuesta
test('el paciente confirma solo su cita y no puede usar el RPC de servidor ni modificar una reserva ajena',async()=>{
 citaRespuesta=(await como(4,tx=>tx.query('select clinica_crear_cita(1,1,$1,$2) r',['2040-06-01T16:00:00Z','Asistencia']))).rows[0].r.id
 versionRespuesta=(await como(6,tx=>tx.query('select clinica_portal_paciente() r'))).rows[0].r.citas.find(c=>c.id===citaRespuesta).version
 assert.match(versionRespuesta,/^[a-f0-9]{32}$/)
 await assert.rejects(como(6,tx=>tx.query("select clinica_responder_cita_actor(6,$1,$2,'cancelar',null,'telegram')",[citaRespuesta,versionRespuesta])),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query("select clinica_responder_cita(101,$1,'confirmar')",[versionRespuesta])),e=>e.code==='42501')
 await assert.rejects(como(4,tx=>tx.query("select clinica_responder_cita($1,$2,'confirmar')",[citaRespuesta,versionRespuesta])),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'confirmar')",[citaRespuesta,'0'.repeat(32)])),e=>e.code==='40001')
 const responder=()=>como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'confirmar') r",[citaRespuesta,versionRespuesta]))
 await responder();const cuenta=(await db.query("select count(*)::int n from notificaciones where cita_id=$1 and titulo='Cita confirmada'",[citaRespuesta])).rows[0].n
 assert.equal((await db.query('select estado from citas where id=$1',[citaRespuesta])).rows[0].estado,'confirmada')
 assert.equal(cuenta,4);await responder()
 assert.equal((await db.query("select count(*)::int n from notificaciones where cita_id=$1 and titulo='Cita confirmada'",[citaRespuesta])).rows[0].n,cuenta)
})

test('solicitar otro horario exige disponibilidad, avisa a recepción y conserva la reserva hasta reagendar',async()=>{
 await assert.rejects(como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'reagendar','')",[citaRespuesta,versionRespuesta])),/días y horarios/)
 const disponibilidad='Puedo el 2 o 3 de junio entre las 16:00 y las 18:00.'
 const solicitar=()=>como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'reagendar',$3)",[citaRespuesta,versionRespuesta,disponibilidad]))
 await solicitar();await solicitar()
 const pendientes=(await db.query("select * from cita_solicitudes_cambio where cita_id=$1 and estado='pendiente'",[citaRespuesta])).rows
 assert.equal(pendientes.length,1);assert.equal(pendientes[0].disponibilidad,disponibilidad)
 assert.equal((await db.query('select estado from citas where id=$1',[citaRespuesta])).rows[0].estado,'confirmada')
 const avisos=(await db.query("select usuario_id,mensaje from notificaciones where cita_id=$1 and tipo='solicitud_cambio' order by usuario_id",[citaRespuesta])).rows
 assert.deepEqual(avisos.map(a=>a.usuario_id),[1,4,6]);assert.ok(avisos.every(a=>a.mensaje.includes(disponibilidad)))
 assert.equal((await como(2,tx=>tx.query('select * from cita_solicitudes_cambio'))).rows.length,0)
 await assert.rejects(como(2,tx=>tx.query('select clinica_listar_cambios_cita()')),e=>e.code==='42501')
 assert.equal((await como(4,tx=>tx.query('select clinica_listar_cambios_cita() r'))).rows[0].r[0].paciente,'Paciente uno')
 const cuentaAntes=(await db.query("select count(*)::int n from notificaciones where cita_id=$1 and tipo='cita_reprogramada'",[citaRespuesta])).rows[0].n
 await como(4,tx=>tx.query("update citas set inicio='2040-06-02T22:00Z',fin='2040-06-02T22:20Z' where id=$1",[citaRespuesta]))
 const despues=(await db.query('select * from citas where id=$1',[citaRespuesta])).rows[0]
 assert.equal(despues.estado,'pendiente')
 assert.equal((await db.query('select estado from cita_solicitudes_cambio where id=$1',[pendientes[0].id])).rows[0].estado,'reagendada')
 assert.equal((await db.query("select count(*)::int n from notificaciones where cita_id=$1 and tipo='cita_reprogramada'",[citaRespuesta])).rows[0].n,cuentaAntes+4)
 await assert.rejects(como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'cancelar')",[citaRespuesta,versionRespuesta])),e=>e.code==='40001')
 versionRespuesta=(await db.query('select clinica_version_reserva(c) v from citas c where id=$1',[citaRespuesta])).rows[0].v
})

test('recepción puede responder sin cambiar la cita y la cancelación voluntaria cierra solicitudes y libera el turno',async()=>{
 await como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'reagendar','Disponible el 4 de junio por la mañana.')",[citaRespuesta,versionRespuesta]))
 let s=(await db.query("select id from cita_solicitudes_cambio where cita_id=$1 and estado='pendiente'",[citaRespuesta])).rows[0]
 await assert.rejects(como(6,tx=>tx.query("select clinica_cerrar_cambio_cita($1,'Respuesta no autorizada')",[s.id])),e=>e.code==='42501')
 await como(4,tx=>tx.query("select clinica_cerrar_cambio_cita($1,'Por favor comunícate con recepción para acordar la hora exacta.')",[s.id]))
 assert.equal((await db.query('select estado from cita_solicitudes_cambio where id=$1',[s.id])).rows[0].estado,'cerrada')
 assert.ok((await db.query("select id from notificaciones where usuario_id=6 and tipo='respuesta_cambio'")).rows.length)
 await como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'reagendar','Disponible el 5 de junio de 08:00 a 12:00.')",[citaRespuesta,versionRespuesta]))
 s=(await db.query("select id from cita_solicitudes_cambio where cita_id=$1 and estado='pendiente'",[citaRespuesta])).rows[0]
 await como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'cancelar')",[citaRespuesta,versionRespuesta]))
 assert.equal((await db.query('select estado from cita_solicitudes_cambio where id=$1',[s.id])).rows[0].estado,'anulada')
 assert.equal((await db.query('select estado from citas where id=$1',[citaRespuesta])).rows[0].estado,'cancelada_paciente')
 assert.ok((await como(4,tx=>tx.query('select clinica_crear_cita(2,1,$1,$2) r',['2040-06-02T22:00:00Z','Turno liberado']))).rows[0].r.id)
})

test('se generan recordatorios de 24 horas, 2 horas y 30 minutos sin repetir ventanas ni recordar citas cerradas',async()=>{
 const id=(await como(4,tx=>tx.query('select clinica_crear_cita(1,1,$1,$2) r',['2041-07-01T16:00:00Z','Recordatorios']))).rows[0].r.id
 for(const ahora of ['2041-06-30T17:00Z','2041-07-01T14:30Z','2041-07-01T15:40Z']) { await db.query('select clinica_generar_recordatorios($1)',[ahora]);await db.query('select clinica_generar_recordatorios($1)',[ahora]) }
 const avisos=(await db.query("select tipo,count(*)::int n from notificaciones where cita_id=$1 and tipo like 'recordatorio_%' group by tipo order by tipo",[id])).rows
 assert.deepEqual(avisos,[{tipo:'recordatorio_24h',n:2},{tipo:'recordatorio_2h',n:2},{tipo:'recordatorio_30m',n:2}])
 await como(4,tx=>tx.query("update citas set estado='cancelada_paciente' where id=$1",[id]))
 const v=(await db.query('select clinica_version_reserva(c) v from citas c where id=$1',[id])).rows[0].v
 await assert.rejects(como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'confirmar')",[id,v])),/ya no admite/)
 assert.equal((await db.query('select clinica_generar_recordatorios($1) n',['2041-07-01T15:50Z'])).rows[0].n,0)
})

test('los botones Telegram pertenecen al paciente vinculado, confirman asistencia y requieren un segundo paso para cancelar',async()=>{
 const id=(await como(4,tx=>tx.query('select clinica_crear_cita(1,1,$1,$2) r',['2042-07-01T16:00:00Z','Botones Telegram']))).rows[0].r.id
 await db.query("insert into telegram_cuentas(usuario_id,chat_id,nombre) values(6,999,'Paciente uno')")
 const cita=(await db.query('select c.*,clinica_version_reserva(c) version from citas c where id=$1',[id])).rows[0]
 assert.equal(await botonesParaCita(dbBot,4,cita),undefined)
 const teclado=await botonesParaCita(dbBot,6,cita),datos=teclado.inline_keyboard[0][0].callback_data
 assert.equal(await botonesParaCita(dbBot,6,{...cita,version:'0'.repeat(32)}),undefined)
 const capturas=[],fetcher=async(url,req)=>{capturas.push({metodo:url.split('/').pop(),...JSON.parse(req.body)});return{ok:true,json:async()=>({ok:true,result:{message_id:500}})}}
 const cb=(update_id,data,chat=999)=>({update_id,callback_query:{id:'cb'+update_id,data,from:{id:chat},message:{message_id:10,chat:{type:'private',id:chat}}}})
 await procesarActualizaciones(dbBot,'simulado',[cb(200,datos,777)],fetcher)
 assert.equal((await db.query('select estado from citas where id=$1',[id])).rows[0].estado,'pendiente')
 await procesarActualizaciones(dbBot,'simulado',[cb(201,datos)],fetcher)
 assert.equal((await db.query('select estado from citas where id=$1',[id])).rows[0].estado,'confirmada')
 await procesarActualizaciones(dbBot,'simulado',[cb(202,datos.replace('cita:c:','cita:x:'))],fetcher)
 assert.equal((await db.query('select estado from citas where id=$1',[id])).rows[0].estado,'confirmada')
 const cancelar=capturas.find(c=>c.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data?.startsWith('cita:d:')).reply_markup.inline_keyboard[0][0].callback_data
 await procesarActualizaciones(dbBot,'simulado',[cb(203,cancelar)],fetcher)
 assert.equal((await db.query('select estado from citas where id=$1',[id])).rows[0].estado,'cancelada_paciente')
 await procesarActualizaciones(dbBot,'simulado',[cb(204,datos)],fetcher)
 assert.equal((await db.query('select estado from citas where id=$1',[id])).rows[0].estado,'cancelada_paciente')
})

test('Telegram recoge disponibilidad por respuesta privada y rechaza botones de una reserva cambiada o un chat desvinculado',async()=>{
 const id=(await como(4,tx=>tx.query('select clinica_crear_cita(1,1,$1,$2) r',['2043-07-01T16:00:00Z','Reagenda Telegram']))).rows[0].r.id
 const cita=(await db.query('select c.*,clinica_version_reserva(c) version from citas c where id=$1',[id])).rows[0]
 const teclado=await botonesParaCita(dbBot,6,cita),datos=teclado.inline_keyboard[1][0].callback_data
 const capturas=[],fetcher=async(url,req)=>{capturas.push({metodo:url.split('/').pop(),...JSON.parse(req.body)});return{ok:true,json:async()=>({ok:true,result:{message_id:600}})}}
 const cb=update_id=>({update_id,callback_query:{id:'cb'+update_id,data:datos,from:{id:999},message:{message_id:11,chat:{type:'private',id:999}}}})
 await procesarActualizaciones(dbBot,'simulado',[cb(205)],fetcher)
 assert.ok(capturas.some(c=>c.text?.includes('horario publicado')))
 // Los mensajes anteriores con ForceReply siguen aceptándose, sujetos al límite horario.
 await db.query("update telegram_acciones_cita set pregunta_id=600,pregunta_hasta=clock_timestamp()+interval '30 minutes' where token=$1",[datos.split(':')[2]])
 const reply={chat:{type:'private',id:999},from:{id:999},reply_to_message:{message_id:600},text:'Puedo el lunes y martes de 09:00 a 12:00.'}
 await procesarActualizaciones(dbBot,'simulado',[{update_id:206,message:{...reply,from:{id:777}}}],fetcher)
 assert.equal((await db.query('select count(*)::int n from cita_solicitudes_cambio where cita_id=$1',[id])).rows[0].n,0)
 await procesarActualizaciones(dbBot,'simulado',[{update_id:207,message:reply}],fetcher)
 const solicitud=(await db.query('select * from cita_solicitudes_cambio where cita_id=$1',[id])).rows[0]
 assert.equal(solicitud.canal,'telegram');assert.equal(solicitud.disponibilidad,reply.text)
 assert.equal((await db.query('select estado from citas where id=$1',[id])).rows[0].estado,'pendiente')
 await como(4,tx=>tx.query("update citas set inicio='2043-07-02T16:00Z',fin='2043-07-02T16:20Z' where id=$1",[id]))
 const cantidad=capturas.length
 await procesarActualizaciones(dbBot,'simulado',[cb(208)],fetcher)
 assert.ok(capturas.slice(cantidad).some(c=>c.show_alert&&c.text.includes('mensaje ya no permite')))
 await db.query('update telegram_cuentas set activo=false where usuario_id=6')
 assert.ok(capturas.every(c=>c.chat_id==null||c.chat_id===999))
})

test('desvincular y volver a vincular Telegram invalida los botones anteriores; /citas solo devuelve las reservas propias',async()=>{
 await db.query('update telegram_cuentas set activo=true,vinculado_en=clock_timestamp() where usuario_id=6')
 const id=(await como(4,tx=>tx.query('select clinica_crear_cita(1,1,$1,$2) r',['2044-07-01T16:00:00Z','Reenlace Telegram']))).rows[0].r.id
 const cita=(await db.query('select c.*,clinica_version_reserva(c) version from citas c where id=$1',[id])).rows[0]
 const teclado=await botonesParaCita(dbBot,6,cita),datos=teclado.inline_keyboard[0][0].callback_data
 await db.query("update telegram_cuentas set vinculado_en=clock_timestamp()+interval '1 second' where usuario_id=6")
 const capturas=[],fetcher=async(url,req)=>{capturas.push({metodo:url.split('/').pop(),...JSON.parse(req.body)});return{ok:true,json:async()=>({ok:true,result:{message_id:700}})}}
 await procesarActualizaciones(dbBot,'simulado',[{update_id:209,callback_query:{id:'cb209',data:datos,from:{id:999},message:{message_id:12,chat:{type:'private',id:999}}}}],fetcher)
 assert.equal((await db.query('select estado from citas where id=$1',[id])).rows[0].estado,'pendiente')
 assert.ok(capturas.some(c=>c.show_alert))
 await procesarActualizaciones(dbBot,'simulado',[{update_id:210,message:{chat:{type:'private',id:999},from:{id:999},text:'/citas'}}],fetcher)
 const citas=capturas.filter(c=>c.parse_mode==='HTML')
 assert.ok(citas.length>0&&citas.length<=5)
 assert.ok(citas.every(c=>c.text.includes('Paciente: Paciente uno')&&!c.text.includes('Paciente dos')&&c.reply_markup.inline_keyboard.length>0))
})

let reservaTurnos, versionTurnos, fechaTurnos
const bloquesAna=[0,1,2,4,6].map(dia=>({dia,inicio:'08:00',fin:'20:00',paso:20}))
test('los turnos propios respetan jornada, miércoles y viernes libres, descansos y ocupación de médico y paciente',async()=>{
 fechaTurnos=(await db.query("select to_char(d,'YYYY-MM-DD') f from generate_series((clock_timestamp() at time zone 'America/Mexico_City')::date+1,(clock_timestamp() at time zone 'America/Mexico_City')::date+7,interval '1 day') d where extract(dow from d) not in(3,5) order by d limit 1")).rows[0].f
 await como(1,tx=>tx.query('select clinica_guardar_agenda(1,$1,$2)',[JSON.stringify(bloquesAna),JSON.stringify([{fecha:fechaTurnos,inicio:'10:00',fin:'10:40'}])]))
 const antiguo=(await db.query("select (($1::date+14+time '10:00') at time zone 'America/Mexico_City')::text t",[fechaTurnos])).rows[0].t
 reservaTurnos=(await como(4,tx=>tx.query('select clinica_crear_cita(1,1,$1,$2) r',[antiguo,'Seleccionar turno']))).rows[0].r.id
 await como(4,tx=>tx.query('select clinica_crear_cita(2,1,$1,$2)',[fechaTurnos+'T11:00:00-06:00','Ocupación del médico']))
 await como(4,tx=>tx.query('select clinica_crear_cita(1,2,$1,$2)',[fechaTurnos+'T12:00:00-06:00','Ocupación del paciente']))
 versionTurnos=(await db.query('select clinica_version_reserva(c) v from citas c where id=$1',[reservaTurnos])).rows[0].v
 const r=(await como(6,tx=>tx.query('select clinica_turnos_cita($1,$2,$3) r',[reservaTurnos,versionTurnos,fechaTurnos]))).rows[0].r
 assert.equal(r.permitido,true);assert.equal(r.configurado,true);assert.ok(r.turnos.length>0)
 const locales=r.turnos.map(t=>{const dia=new Date(t.inicio).toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'});return{dia,hora:new Date(t.inicio).toLocaleTimeString('en-GB',{timeZone:'America/Mexico_City',hourCycle:'h23'}),semana:new Date(dia+'T12:00:00Z').getUTCDay()}})
 assert.ok(locales.every(t=>![3,5].includes(t.semana)&&t.hora>='08:00:00'&&t.hora<'20:00:00'))
 assert.ok(!locales.some(t=>t.dia===fechaTurnos&&['10:00:00','10:20:00','11:00:00','12:00:00'].includes(t.hora)))
 await assert.rejects(como(2,tx=>tx.query('select clinica_turnos_cita($1,$2)',[reservaTurnos,versionTurnos])),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query('select clinica_turnos_cita_actor(6,$1,$2)',[reservaTurnos,versionTurnos])),e=>e.code==='42501')
})

test('elegir un turno vuelve a validar ocupación, conserva la cita ante conflicto y confirma el cambio sin duplicarla',async()=>{
 const opciones=(await como(6,tx=>tx.query('select clinica_turnos_cita($1,$2,$3) r',[reservaTurnos,versionTurnos,fechaTurnos]))).rows[0].r.turnos
 const ocupado=opciones[0],elegido=opciones[1],anterior=(await db.query('select inicio from citas where id=$1',[reservaTurnos])).rows[0].inicio
 await como(4,tx=>tx.query('select clinica_crear_cita(3,1,$1,$2)',[ocupado.inicio,'Se ocupó mientras elegía']))
 await assert.rejects(como(6,tx=>tx.query('select clinica_reagendar_turno($1,$2,$3)',[reservaTurnos,versionTurnos,ocupado.inicio])),e=>e.code==='23P01')
 assert.equal(Date.parse((await db.query('select inicio from citas where id=$1',[reservaTurnos])).rows[0].inicio),Date.parse(anterior))
 const r=(await como(6,tx=>tx.query('select clinica_reagendar_turno($1,$2,$3) r',[reservaTurnos,versionTurnos,elegido.inicio]))).rows[0].r
 assert.ok(r.mensaje.includes('confirmada'))
 const actual=(await db.query('select inicio,estado from citas where id=$1',[reservaTurnos])).rows[0]
 assert.equal(Date.parse(actual.inicio),Date.parse(elegido.inicio));assert.equal(actual.estado,'confirmada')
 const avisos=(await db.query("select usuario_id from notificaciones where cita_id=$1 and tipo='cita_reprogramada' order by usuario_id",[reservaTurnos])).rows
 assert.deepEqual(avisos.map(a=>a.usuario_id),[1,2,4,6])
 await assert.rejects(como(6,tx=>tx.query('select clinica_reagendar_turno($1,$2,$3)',[reservaTurnos,versionTurnos,elegido.inicio])),e=>e.code==='40001')
 assert.equal((await db.query('select count(*)::int n from citas where id=$1',[reservaTurnos])).rows[0].n,1)
})

test('a dos horas o menos no se permite reagendar ni por solicitud antigua ni por edición directa; confirmar y cancelar siguen permitidos',async()=>{
 await como(1,tx=>tx.query("select clinica_guardar_agenda(1,'[]','[]')"))
 for(const minutos of [90,120,130]){
  const inicio=(await db.query('select clock_timestamp()+make_interval(mins=>$1) t',[minutos])).rows[0].t
  const id=(await como(4,tx=>tx.query('select clinica_crear_cita(1,1,$1,$2) r',[inicio,'Límite de aviso']))).rows[0].r.id
  const v=(await db.query('select clinica_version_reserva(c) v from citas c where id=$1',[id])).rows[0].v
  const horarios=(await como(6,tx=>tx.query('select clinica_turnos_cita($1,$2) r',[id,v]))).rows[0].r
  assert.equal(horarios.permitido,minutos>120)
  if(minutos<=120){
   await assert.rejects(como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'reagendar','Disponible mañana de 10:00 a 12:00')",[id,v])),/dos horas o menos/)
   await assert.rejects(como(6,tx=>tx.query("select clinica_reagendar_turno($1,$2,clock_timestamp()+interval '1 day')",[id,v])),/dos horas o menos/)
   await assert.rejects(como(4,tx=>tx.query("update citas set inicio=inicio+interval '1 day',fin=fin+interval '1 day' where id=$1",[id])),/dos horas o menos/)
  }
  await como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'confirmar')",[id,v]))
  await como(6,tx=>tx.query("select clinica_responder_cita($1,$2,'cancelar')",[id,v]))
  assert.equal((await db.query('select estado from citas where id=$1',[id])).rows[0].estado,'cancelada_paciente')
 }
 await como(1,tx=>tx.query('select clinica_guardar_agenda(1,$1,$2)',[JSON.stringify(bloquesAna),'[]']))
})

test('Telegram muestra días y horas libres y solo el paciente vinculado puede escoger un turno',async()=>{
 const inicio=(await db.query("select (($1::date+28+time '10:00') at time zone 'America/Mexico_City')::text t",[fechaTurnos])).rows[0].t
 const id=(await como(4,tx=>tx.query('select clinica_crear_cita(1,1,$1,$2) r',[inicio,'Turnos por Telegram']))).rows[0].r.id
 const c=(await db.query('select c.*,clinica_version_reserva(c) version from citas c where id=$1',[id])).rows[0]
 const teclado=await botonesParaCita(dbBot,6,c),datos=teclado.inline_keyboard.flat().find(b=>b.text.includes('Ver horarios libres')).callback_data
 const capturas=[],fetcher=async(url,req)=>{capturas.push({metodo:url.split('/').pop(),...JSON.parse(req.body)});return{ok:true,json:async()=>({ok:true,result:{message_id:900}})}}
 const cb=(update_id,data,chat=999)=>({update_id,callback_query:{id:'turno'+update_id,data,from:{id:chat},message:{message_id:900,chat:{type:'private',id:chat}}}})
 await procesarActualizaciones(dbBot,'simulado',[cb(300,datos)],fetcher)
 const mensaje=capturas.find(m=>m.reply_markup?.inline_keyboard?.flat().some(b=>b.callback_data.startsWith('turno:')))
 assert.ok(mensaje);assert.equal(mensaje.reply_markup.force_reply,undefined)
 const botones=mensaje.reply_markup.inline_keyboard.flat();assert.ok(botones.every(b=>Buffer.byteLength(b.callback_data)<=64))
 const turno=botones.find(b=>b.callback_data.startsWith('turno:')).callback_data
 await procesarActualizaciones(dbBot,'simulado',[cb(301,turno,777)],fetcher)
 assert.equal(Date.parse((await db.query('select inicio from citas where id=$1',[id])).rows[0].inicio),Date.parse(inicio))
 await procesarActualizaciones(dbBot,'simulado',[cb(302,turno)],fetcher)
 const cambiado=(await db.query('select inicio,estado from citas where id=$1',[id])).rows[0]
 assert.notEqual(Date.parse(cambiado.inicio),Date.parse(inicio));assert.equal(cambiado.estado,'confirmada')
 const cuenta=(await db.query("select count(*)::int n from notificaciones where cita_id=$1 and tipo='cita_reprogramada'",[id])).rows[0].n
 await procesarActualizaciones(dbBot,'simulado',[cb(303,turno)],fetcher)
 assert.equal((await db.query("select count(*)::int n from notificaciones where cita_id=$1 and tipo='cita_reprogramada'",[id])).rows[0].n,cuenta)
})

test('el paciente reserva con su identidad, evita duplicados y revalida horario y duración',async()=>{
 const meta=(await como(6,tx=>tx.query('select clinica_agenda_reserva() r'))).rows[0].r
 assert.equal(meta.paciente.nombre,'Paciente uno');assert.ok(meta.medicos.some(m=>m.id===1&&m.publicado))
 await assert.rejects(como(4,tx=>tx.query('select clinica_agenda_reserva()')),e=>e.code==='42501')
 const agenda=(await como(6,tx=>tx.query('select clinica_agenda_reserva(1) r'))).rows[0].r
 const t=agenda.turnos[0],clave=uid(500)
 const reservar=()=>como(6,tx=>tx.query('select clinica_agendar_paciente(1,$1,$2,$3) r',[t.inicio,t.fin,clave]))
 const r=(await reservar()).rows[0].r
 const cita=(await db.query('select * from citas where id=$1',[r.id])).rows[0]
 assert.equal(cita.paciente_id,1);assert.equal(cita.estado,'confirmada')
 assert.equal((await reservar()).rows[0].r.id,r.id)
 assert.deepEqual((await db.query("select usuario_id from notificaciones where cita_id=$1 and tipo='cita_nueva' order by usuario_id",[r.id])).rows.map(v=>v.usuario_id),[1,2,4,6])
 await assert.rejects(como(6,tx=>tx.query('select clinica_agendar_paciente(1,$1,$2,$3)',[t.inicio,t.fin,uid(501)])),e=>e.code==='23P01')
 const libre=agenda.turnos[1]
 await assert.rejects(como(6,tx=>tx.query('select clinica_agendar_paciente(1,$1,$2,$3)',[libre.inicio,t.fin,uid(502)])),e=>e.code==='23P01')
 await assert.rejects(como(6,tx=>tx.query('select clinica_agendar_paciente_actor(7,1,$1,$2,$3)',[libre.inicio,libre.fin,uid(503)])),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query('select clinica_agendar_paciente(1,$1,$2,$3)',[libre.inicio,libre.fin,clave])),e=>e.code==='40001')
})

test('Telegram crea una nueva cita solo al confirmar y rechaza botones de otra cuenta o de un vínculo anterior',async()=>{
 const capturas=[],fetcher=async(url,req)=>{capturas.push(JSON.parse(req.body));return{ok:true,json:async()=>({ok:true,result:{message_id:1000}})}}
 const cb=(update_id,data,chat=999)=>({update_id,callback_query:{id:'nuevo'+update_id,data,from:{id:chat},message:{chat:{type:'private',id:chat}}}})
 const cantidad=async()=>Number((await db.query('select count(*) n from citas')).rows[0].n)
 const previo=await cantidad()
 await procesarActualizaciones(dbBot,'simulado',[{update_id:400,message:{chat:{type:'private',id:999},from:{id:999},text:'/agendar'}}],fetcher)
 const boton=capturas.flatMap(c=>c.reply_markup?.inline_keyboard.flat()??[]).find(b=>b.callback_data.startsWith('medico:'))
 assert.ok(boton)
 await procesarActualizaciones(dbBot,'simulado',[cb(401,boton.callback_data)],fetcher)
 const elegir=capturas.flatMap(c=>c.reply_markup?.inline_keyboard.flat()??[]).find(b=>b.callback_data.startsWith('reservar:'))
 assert.ok(elegir)
 await procesarActualizaciones(dbBot,'simulado',[cb(402,elegir.callback_data,777)],fetcher)
 assert.equal(await cantidad(),previo)
 await procesarActualizaciones(dbBot,'simulado',[cb(403,elegir.callback_data)],fetcher)
 assert.equal(await cantidad(),previo)
 const confirmar=capturas.flatMap(c=>c.reply_markup?.inline_keyboard.flat()??[]).find(b=>b.callback_data.startsWith('confirmar:'))
 assert.ok(confirmar)
 await procesarActualizaciones(dbBot,'simulado',[cb(404,confirmar.callback_data)],fetcher)
 assert.equal(await cantidad(),previo+1)
 await procesarActualizaciones(dbBot,'simulado',[cb(405,confirmar.callback_data)],fetcher)
 assert.equal(await cantidad(),previo+1)
 assert.ok(capturas.flatMap(c=>c.reply_markup?.inline_keyboard.flat()??[]).every(b=>Buffer.byteLength(b.callback_data)<=64))
 const intent=(await db.query('select token from telegram_reservas order by vence_en desc limit 1')).rows[0].token
 await db.exec("update telegram_cuentas set vinculado_en=clock_timestamp() where usuario_id=6")
 await assert.rejects(db.query('select clinica_horas_reserva_telegram($1,999)',[intent]),e=>e.code==='42501')
})

test('inactividad bloquea REST y RPC; renovar el mismo JWT no desbloquea y una nueva sesión verificada sí',async()=>{
 const sid=uid(600),nuevo=uid(601)
 await db.query('insert into auth.sessions values($1,$3),($2,$3)',[sid,nuevo,uid(6)])
 let r=(await como(6,tx=>tx.query('select clinica_estado_sesion() r'),sid)).rows[0].r
 assert.equal(r.bloqueada,false)
 const anterior=r.ultimaActividad
 await como(6,tx=>tx.query('select clinica_estado_sesion()'),sid)
 assert.equal((await db.query('select ultimo_movimiento from sesiones_clinica where id=$1',[sid])).rows[0].ultimo_movimiento.toISOString(),new Date(anterior).toISOString())
 await db.query("update sesiones_clinica set ultimo_movimiento=clock_timestamp()-interval '15 minutes' where id=$1",[sid])
 assert.equal((await como(6,tx=>tx.query('select id from citas'),sid)).rows.length,0)
 await assert.rejects(como(6,tx=>tx.query('select clinica_agenda_reserva()'),sid),e=>e.code==='42501')
 r=(await como(6,tx=>tx.query("select clinica_estado_sesion('actividad') r"),sid)).rows[0].r
 assert.equal(r.bloqueada,true)
 assert.equal((await como(6,tx=>tx.query('select clinica_estado_sesion() r'),sid)).rows[0].r.bloqueada,true)
 assert.equal((await como(6,tx=>tx.query('select clinica_estado_sesion() r'),nuevo)).rows[0].r.bloqueada,false)
 assert.ok((await como(6,tx=>tx.query('select id from citas'),nuevo)).rows.length>0)
 await assert.rejects(como(2,tx=>tx.query('select clinica_estado_sesion()'),nuevo),e=>e.code==='42501')
 await db.query('delete from auth.sessions where id=$1',[nuevo])
 await assert.rejects(como(6,tx=>tx.query('select clinica_estado_sesion()'),nuevo),e=>e.code==='42501')
 assert.equal((await como(6,tx=>tx.query('select id from citas'),nuevo)).rows.length,0)
})
