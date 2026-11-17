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
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql','034_correo_paciente.sql','035_consultorios.sql','036_espera_y_controles.sql','037_comunicaciones_y_reportes.sql','038_datos_personales_paciente.sql','039_conflicto_perfil.sql','040_muestras_ambulatorias.sql','041_lectura_orden_insertada.sql','042_prorroga_consultorios.sql','043_registro_publico_paciente.sql','044_validacion_contactos.sql','045_comunicacion_equipo.sql','046_eliminaciones_administrador.sql','047_ingreso_urgente_enfermeria.sql','048_enfermeria_censo_y_selector.sql','049_edicion_administrativa_expedientes.sql']) { try { await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8').replaceAll('clock_timestamp()', 'public.reloj_aceptacion()')) } catch(e){throw Error(nombre+': '+e.message+' '+(e.where??'')+' '+(e.position??''))} }
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

const contenido={subjetivo:'Evolución administrativa corregida',objetivo:'Hallazgos corregidos',diagnostico:'Diagnóstico actualizado',plan:'Plan actualizado',pronostico:'Estable',seguimiento:'Control en una semana',recetaLibre:'Indicaciones actualizadas',medicamentos:[{nombre:'Medicamento de prueba',dosis:'Dosis prescrita',via:'Oral',frecuencia:'Según indicación',duracion:'Duración indicada'}]}
const datos=async(extra={})=>({citaId:200,version:(await rpc(1,'clinica_consulta_leer($1)',[200])).version,contenido,...extra})
let solicitud,revisionInicial
test('administración edita directamente una nota cerrada y conserva cierre, autor, signos y estado de la cita',async()=>{
 await db.exec(`insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin,estado) values(200,1,1,1,(('${dia}'::date+1)+time '10:00') at time zone 'America/Mexico_City',(('${dia}'::date+1)+time '10:20') at time zone 'America/Mexico_City','pendiente');
 insert into expedientes(id,cita_id,autor_medico_id,diagnostico,contenido,estado_nota,cerrada_en,cerrada_por)
 values(200,200,1,'Diagnóstico anterior','{"diagnostico":"Diagnóstico anterior","signos":{"valores":{"pulso":72},"autor":"Enfermería"}}','cerrada','2026-01-03 10:20Z',2);
 update citas set estado='atendida' where id=200`)
 await rpc(1,'clinica_estado_sesion()')
 const antes=(await db.query('select * from expedientes where id=200')).rows[0];revisionInicial=antes.revision
 solicitud=await datos({contenido:{...contenido,signos:{valores:{pulso:999}},estado_nota:'borrador',autor_medico_id:999},autor:999,cerrar:true})
 const r=await rpc(1,'clinica_admin_editar_nota($1,$2)',[solicitud,uid(201)])
 assert.equal(r.id,200)
 const despues=(await db.query('select * from expedientes where id=200')).rows[0]
 assert.equal(despues.diagnostico,contenido.diagnostico);assert.equal(despues.contenido.plan,contenido.plan)
 for(const campo of ['cita_id','autor_medico_id','estado_nota','cerrada_en','cerrada_por','creado_en'])assert.deepEqual(despues[campo],antes[campo])
 assert.deepEqual(despues.contenido.signos,antes.contenido.signos)
 assert.equal((await db.query('select estado from citas where id=200')).rows[0].estado,'atendida')
 assert.equal((await db.query('select count(*)::int n from consulta_correcciones where expediente_id=200')).rows[0].n,0)
 const auditoria=(await db.query("select * from auditoria_clinica where accion='EDICION_ADMIN' and registro_id='200'")).rows
 assert.equal(auditoria.length,1);assert.equal(auditoria[0].autor,uid(1));assert.equal(auditoria[0].anterior.diagnostico,'Diagnóstico anterior');assert.equal(auditoria[0].nuevo.diagnostico,contenido.diagnostico)
})
test('el reintento no duplica la edición y una versión antigua no sobreescribe cambios',async()=>{
 await rpc(1,'clinica_admin_editar_nota($1,$2)',[solicitud,uid(201)])
 assert.equal((await db.query('select revision from expedientes where id=200')).rows[0].revision,revisionInicial+1)
 await assert.rejects(rpc(1,'clinica_admin_editar_nota($1,$2)',[solicitud,uid(202)]),e=>e.code==='40001')
 await assert.rejects(rpc(1,'clinica_admin_editar_nota($1,$2)',[{...solicitud,contenido},uid(201)]),e=>e.code==='40001')
})
test('los demás roles no editan notas cerradas y el médico conserva la vía de aclaraciones',async()=>{
 const d=await datos()
 for(const n of [2,4,5,6]){await rpc(n,'clinica_estado_sesion()');await assert.rejects(rpc(n,'clinica_admin_editar_nota($1,$2)',[d,uid(203)]),e=>e.code==='42501')}
 await assert.rejects(como(1,tx=>tx.exec("update expedientes set diagnostico='Fuera de operación auditada' where id=200")),e=>e.code==='42501')
 await assert.rejects(como(2,async tx=>{await tx.exec("select set_config('clinica.edicion_nota_admin','confirmado',true)");return tx.exec("update expedientes set diagnostico='Intento médico' where id=200")}),e=>e.code==='42501')
 await rpc(2,'clinica_medico_operar($1,$2,$3)',['corregir',{citaId:200,version:d.version,motivo:'Aclaración del médico',texto:'Se agrega una aclaración sin reemplazar la nota.'},uid(204)])
 assert.equal((await db.query('select count(*)::int n from consulta_correcciones where expediente_id=200')).rows[0].n,1)
})
test('la validación rechaza contenido inválido sin cambiar el expediente ni su auditoría',async()=>{
 const d=await datos()
 for(const cambio of [{diagnostico:''},{plan:'a'.repeat(8001)},{medicamentos:[{nombre:'Sin dosis'}]},{subjetivo:42}])await assert.rejects(rpc(1,'clinica_admin_editar_nota($1,$2)',[{...d,contenido:{...contenido,...cambio}},uid(205)]),e=>e.code==='23514')
 assert.equal((await db.query('select diagnostico from expedientes where id=200')).rows[0].diagnostico,contenido.diagnostico)
 assert.equal((await db.query("select count(*)::int n from auditoria_clinica where accion='EDICION_ADMIN' and registro_id='200'")).rows[0].n,1)
 await assert.rejects(rpc(1,'clinica_admin_editar_nota($1,$2)',[{...d,citaId:9999},uid(205)]),e=>e.code==='P0002')
})
const clave=n=>uid(1000+n)
const operar=async(n,accion,datos,k)=>rpc(n,'clinica_equipo_operar($1,$2::jsonb,$3)',[accion,JSON.stringify(datos),k])
let hilo

