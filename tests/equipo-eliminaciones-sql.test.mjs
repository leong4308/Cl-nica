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
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql','034_correo_paciente.sql','035_consultorios.sql','036_espera_y_controles.sql','037_comunicaciones_y_reportes.sql','038_datos_personales_paciente.sql','039_conflicto_perfil.sql','040_muestras_ambulatorias.sql','041_lectura_orden_insertada.sql','042_prorroga_consultorios.sql','043_registro_publico_paciente.sql','044_validacion_contactos.sql','045_comunicacion_equipo.sql','046_eliminaciones_administrador.sql']) { try { await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8').replaceAll('clock_timestamp()', 'public.reloj_aceptacion()')) } catch(e){throw Error(nombre+': '+e.message+' '+(e.where??'')+' '+(e.position??''))} }
  await db.exec("revoke all on reloj_aceptacion from authenticated,anon;insert into catalogo_analisis(id,nombre) values(1,'Estudio de aceptación')")
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}



const rpc=async(n,func,args=[])=>(await como(n,tx=>tx.query('select '+func+' r',args))).rows[0].r
const clave=n=>uid(1000+n)
const operar=async(n,accion,datos,k)=>rpc(n,'clinica_equipo_operar($1,$2::jsonb,$3)',[accion,JSON.stringify(datos),k])
let hilo

test('enfermería conversa con su médico, responde y conserva identidad, contexto y avisos sin duplicar',async()=>{
 await db.exec("insert into enfermeria_turnos(enfermero_id,paciente_id,inicio,fin,area,autor,clave) values(1,1,public.reloj_aceptacion()-interval '1 hour',public.reloj_aceptacion()+interval '8 hours','Consulta',1,gen_random_uuid())")
 await rpc(5,'clinica_estado_sesion()');await rpc(2,'clinica_estado_sesion()')
 const datos={destinatario:2,pacienteId:1,ambito:'clinico',asunto:'Coordinar atención',contenido:'Solicito revisión de las indicaciones del turno.'}
 hilo=(await operar(5,'enviar',datos,clave(1))).id;await operar(5,'enviar',datos,clave(1))
 assert.equal((await db.query('select count(*)::int n from equipo_mensajes where conversacion_id=$1',[hilo])).rows[0].n,1)
 const panel=await rpc(2,'clinica_equipo_panel()');assert.equal(panel.conversaciones[0].sin_leer,1);assert.equal(panel.conversaciones[0].paciente,'Paciente uno')
 await operar(2,'leer',{id:hilo},clave(2));assert.equal((await rpc(2,'clinica_equipo_panel()')).conversaciones[0].sin_leer,0)
 await operar(2,'responder',{id:hilo,contenido:'Indicación revisada, continuar los cuidados programados.'},clave(3));await operar(2,'responder',{id:hilo,contenido:'Indicación revisada, continuar los cuidados programados.'},clave(3))
 assert.equal((await rpc(5,'clinica_equipo_panel()')).conversaciones[0].mensajes.length,2)
 assert.equal((await db.query("select count(*)::int n from notificaciones where tipo='mensaje_equipo'")).rows[0].n,2)
})

test('recepción intercambia mensajes operativos sin obtener conversaciones clínicas ajenas',async()=>{
 await rpc(4,'clinica_estado_sesion()');const d={destinatario:4,ambito:'administrativo',asunto:'Ingreso pendiente',contenido:'Favor de coordinar la recepción de un paciente.',urgente:true}
 const h=(await operar(5,'enviar',d,clave(4))).id
 const panel=await rpc(4,'clinica_equipo_panel()');assert.equal(panel.conversaciones.length,1);assert.equal(panel.conversaciones[0].id,h)
 await operar(4,'responder',{id:h,contenido:'Recibido. Coordinaremos la recepción del paciente.'},clave(5))
 assert.equal((await como(4,tx=>tx.query('select * from equipo_mensajes where conversacion_id=$1',[hilo]))).rows.length,0)
 await assert.rejects(operar(4,'responder',{id:hilo,contenido:'Acceso ajeno'},clave(6)),e=>e.code==='42501')
 await assert.rejects(operar(5,'enviar',{...d,ambito:'clinico',pacienteId:1},clave(7)),e=>e.code==='42501')
 await assert.rejects(operar(5,'enviar',{...d,destinatario:3,ambito:'clinico',pacienteId:1},clave(8)),e=>e.code==='42501')
})

test('los pacientes, anónimos y terceros no participan en el equipo; la asignación vencida retira el contexto clínico',async()=>{
 await rpc(6,'clinica_estado_sesion()');await assert.rejects(rpc(6,'clinica_equipo_panel()'),e=>e.code==='42501')
 await assert.rejects(como(3,tx=>tx.query("insert into equipo_mensajes(id,conversacion_id,autor,contenido) values($1,$2,3,'Suplantación')",[clave(9),hilo])),e=>e.code==='42501')
 await db.exec("update enfermeria_turnos set fin=public.reloj_aceptacion()-interval '10 minutes'")
 assert.equal((await rpc(5,'clinica_equipo_panel()')).conversaciones.some(c=>c.id===hilo),false)
 await db.exec("update enfermeria_turnos set fin=public.reloj_aceptacion()+interval '8 hours'")
 const panel=await rpc(5,'clinica_enfermeria_panel()');assert.equal(panel.resumenCamas.total,2);assert.equal(panel.resumenCamas.libres,2);assert.equal(panel.mapaCamas.length,2)
})

test('solo administración elimina con confirmación, motivo y versión; no borra historias por cascada',async()=>{
 await rpc(1,'clinica_estado_sesion()')
 const info=await rpc(1,'clinica_admin_eliminacion_info($1,$2)',['Pacientes',1]);assert.equal(info.puedeEliminar,false)
 await assert.rejects(rpc(1,'clinica_admin_eliminar($1,$2,$3,$4,$5)',['Pacientes',1,info.version,'Registro duplicado de prueba',true]),e=>e.code==='23503')
 for(const rol of [2,4,5,6])await assert.rejects(rpc(rol,'clinica_admin_eliminacion_info($1,$2)',['Pacientes',3]),e=>e.code==='42501')
 const libre=await rpc(1,'clinica_admin_eliminacion_info($1,$2)',['Pacientes',3]);assert.equal(libre.puedeEliminar,true)
 await assert.rejects(rpc(1,'clinica_admin_eliminar($1,$2,$3,$4,$5)',['Pacientes',3,libre.version,'Registro duplicado de prueba',false]),e=>e.code==='23514')
 await rpc(1,'clinica_admin_eliminar($1,$2,$3,$4,$5)',['Pacientes',3,libre.version,'Registro duplicado de prueba',true])
 assert.equal((await db.query('select count(*)::int n from perfiles_pacientes where id=3')).rows[0].n,0)
 assert.equal((await db.query('select esta_activo from usuarios where id=8')).rows[0].esta_activo,false)
 assert.equal((await db.query('select count(*)::int n from citas where id=100')).rows[0].n,1)
 assert.equal((await db.query("select count(*)::int n from auditoria_clinica where accion='ELIMINACION_ADMIN' and tabla='perfiles_pacientes'")).rows[0].n,1)
})

test('una nota cerrada solo se elimina por la operación administrativa confirmada y su cita se conserva',async()=>{
 const info=await rpc(1,'clinica_admin_eliminacion_info($1,$2)',['Expedientes',100]);assert.equal(info.puedeEliminar,true)
 await assert.rejects(como(1,tx=>tx.exec('delete from expedientes where id=100')),e=>e.code==='42501')
 await rpc(1,'clinica_admin_eliminar($1,$2,$3,$4,$5)',['Expedientes',100,info.version,'Expediente de prueba duplicado',true])
 assert.equal((await db.query('select count(*)::int n from expedientes where id=100')).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int n from citas where id=100')).rows[0].n,1)
 await assert.rejects(como(1,tx=>tx.exec("update expedientes set diagnostico='Cambiar cerrado' where id=101")),e=>e.code==='42501')
})

test('una versión anterior no elimina datos actualizados',async()=>{
 const info=await rpc(1,'clinica_admin_eliminacion_info($1,$2)',['Expedientes',101])
 await assert.rejects(rpc(1,'clinica_admin_eliminar($1,$2,$3,$4,$5)',['Expedientes',101,'a'.repeat(32),'Expediente de prueba duplicado',true]),e=>e.code==='40001')
 assert.equal((await db.query('select count(*)::int n from expedientes where id=101')).rows[0].n,1)
})

test('retirar documentos exige administrador, ruta válida y motivo y registra la operación',async()=>{
 await assert.rejects(rpc(5,'clinica_admin_retirar_documento($1,$2,$3,$4)',['expedientes',101,'prueba.pdf','Documento duplicado de prueba']),e=>e.code==='42501')
 await assert.rejects(rpc(1,'clinica_admin_retirar_documento($1,$2,$3,$4)',['expedientes',101,'../otro.pdf','Documento duplicado de prueba']),e=>e.code==='23514')
 await rpc(1,'clinica_admin_retirar_documento($1,$2,$3,$4)',['expedientes',101,'prueba.pdf','Documento duplicado de prueba'])
 assert.equal((await db.query("select count(*)::int n from auditoria_clinica where accion='ELIMINAR_DOCUMENTO'")).rows[0].n,1)
 assert.equal((await db.query('select clinica_version() v')).rows[0].v,46)
})

test('eliminar una cita sin historia retira solo sus registros operativos y conserva los pacientes',async()=>{
 await db.exec("insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin) values(301,1,1,1,((public.reloj_aceptacion() at time zone 'America/Mexico_City')::date+1+time '11:00') at time zone 'America/Mexico_City',((public.reloj_aceptacion() at time zone 'America/Mexico_City')::date+1+time '11:20') at time zone 'America/Mexico_City')")
 const info=await rpc(1,'clinica_admin_eliminacion_info($1,$2)',['Citas',301]);assert.equal(info.puedeEliminar,true)
 await rpc(1,'clinica_admin_eliminar($1,$2,$3,$4,$5)',['Citas',301,info.version,'Cita duplicada de prueba funcional',true])
 assert.equal((await db.query('select count(*)::int n from citas where id=301')).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int n from perfiles_pacientes where id=1')).rows[0].n,1)
})

test('el PDF de laboratorio compara el instante de versión y retira la publicación si era el único resultado',async()=>{
 await db.exec("insert into episodios_medicos(id,cita_id,medico_id,tipo_episodio) values(301,100,1,'consulta');insert into ordenes_medicas(id,episodio_id,tipo_orden,descripcion) values(301,301,'analisis','Estudio de prueba');insert into solicitudes_analisis(id,orden_medica_id,analisis_id,archivo_resultado,fecha_resultado,estado_analisis) values(301,301,1,'301/ejemplo.PDF',public.reloj_aceptacion(),'completado')")
 const version=(await db.query("select to_jsonb(fecha_resultado)#>>'{}' v from solicitudes_analisis where id=301")).rows[0].v
 await assert.rejects(rpc(1,'clinica_admin_retirar_documento($1,$2,$3,$4,$5)',['laboratorio',301,'ejemplo.PDF','Archivo adjunto duplicado de prueba','2020-01-01T00:00:00Z']),e=>e.code==='40001')
 await rpc(1,'clinica_admin_retirar_documento($1,$2,$3,$4,$5)',['laboratorio',301,'ejemplo.PDF','Archivo adjunto duplicado de prueba',version])
 const fila=(await db.query('select archivo_resultado,estado_analisis from solicitudes_analisis where id=301')).rows[0]
 assert.equal(fila.archivo_resultado,null);assert.equal(fila.estado_analisis,'en proceso')
})
