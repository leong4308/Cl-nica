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
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql']) await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'))
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}

let secuencia=8000
const clave=()=>uid(secuencia++)
const contenido={subjetivo:'Evolución documentada',objetivo:'Exploración registrada',diagnostico:'Problema clínico documentado',plan:'Indicaciones y vigilancia',medicamentos:[]}
async function leer(n,cita){return (await como(n,tx=>tx.query('select clinica_consulta_leer($1) r',[cita]))).rows[0].r}
async function operar(n,accion,datos,k=clave()){return (await como(n,tx=>tx.query('select clinica_medico_operar($1,$2,$3) r',[accion,JSON.stringify(datos),k]))).rows[0].r}
test('consulta propia, autoría y borradores con revisión optimista e idempotencia',async()=>{
 assert.equal((await db.query('select clinica_version() v')).rows[0].v,31)
 assert.equal((await leer(2,100)).nota.cerrada_en,null)
 await db.exec("insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin) values(200,1,1,1,now()+interval '10 minutes',now()+interval '30 minutes')")
 const ctx=await leer(2,200),sol={citaId:200,version:ctx.version,contenido,cerrar:false},k=clave()
 const inicio=new Date(Date.now()-60000).toISOString(),fin=new Date(Date.now()+8*3600000).toISOString()
 await como(1,tx=>tx.query('select clinica_enfermeria_operar($1,$2,$3)',['asignar',JSON.stringify({pacienteId:1,enfermeroId:1,inicio,fin,area:'Consulta'}),clave()]))
 await como(5,tx=>tx.query('select clinica_enfermeria_operar($1,$2,$3)',['signos',JSON.stringify({pacienteId:1,valores:{sistolica:120,diastolica:80}}),clave()]))
 await operar(2,'guardar',sol,k);await operar(2,'guardar',sol,k)
 assert.equal((await db.query('select count(*)::int n from expedientes where cita_id=200')).rows[0].n,1)
 await assert.rejects(operar(2,'guardar',sol),e=>e.code==='40001')
 await assert.rejects(operar(3,'guardar',sol),e=>e.code==='42501')
 await assert.rejects(como(2,tx=>tx.query("update expedientes set diagnostico='Cambiar' where cita_id=200")),e=>e.code==='42501')
 await assert.rejects(leer(4,200),e=>e.code==='42501')
})
test('finalizar exige datos e inicio y revierte también la nota cuando falla el cambio de cita',async()=>{
 let ctx=await leer(2,200)
 await assert.rejects(operar(2,'guardar',{citaId:200,version:ctx.version,contenido:{...contenido,diagnostico:''},cerrar:true}),/Completa/)
 await assert.rejects(operar(2,'guardar',{citaId:200,version:ctx.version,contenido,cerrar:true}),/iniciar/)
 const v=(await como(4,tx=>tx.query('select clinica_recepcion_panel() r'))).rows[0].r.citas.find(c=>c.id===200).version
 await como(4,tx=>tx.query('select clinica_recepcion_operar($1,$2,$3,null,$4)',[200,v,'llegada',clave()]))
 await como(2,tx=>tx.query('select clinica_recepcion_operar($1,$2,$3,null,$4)',[200,v,'iniciar',clave()]))
 await db.exec("create function bloquear_cierre_prueba() returns trigger language plpgsql as $$begin if new.id=200 and new.estado='atendida' then raise exception 'Fallo de prueba';end if;return new;end$$;create trigger bloquear_prueba before update on citas for each row execute function bloquear_cierre_prueba()")
 const anterior=(await db.query('select revision from expedientes where cita_id=200')).rows[0].revision
 await assert.rejects(operar(2,'guardar',{citaId:200,version:ctx.version,contenido,cerrar:true}),/Fallo de prueba/)
 assert.equal((await db.query('select revision from expedientes where cita_id=200')).rows[0].revision,anterior)
 assert.equal((await db.query('select estado_nota from expedientes where cita_id=200')).rows[0].estado_nota,'borrador')
 await db.exec('drop trigger bloquear_prueba on citas')
 await operar(2,'guardar',{citaId:200,version:ctx.version,contenido,cerrar:true})
 assert.equal((await db.query('select estado from citas where id=200')).rows[0].estado,'atendida')
 const cerrada=await leer(2,200);assert.equal(cerrada.signos.valores.sistolica,120)
 await como(5,tx=>tx.query('select clinica_enfermeria_operar($1,$2,$3)',['signos',JSON.stringify({pacienteId:1,valores:{sistolica:125,diastolica:82}}),clave()]))
 assert.equal((await leer(2,200)).signos.valores.sistolica,120)
})
test('nota cerrada inmutable y correcciones anexas sin destruir autoría ni el original',async()=>{
 const ctx=await leer(2,200),original=ctx.nota.diagnostico
 await assert.rejects(db.exec("update expedientes set diagnostico='Sobrescribir' where cita_id=200"),e=>e.code==='42501')
 await assert.rejects(operar(2,'guardar',{citaId:200,version:ctx.version,contenido,cerrar:false}),/no admite cambios/)
 await operar(2,'corregir',{citaId:200,version:ctx.version,motivo:'Aclaración de seguimiento',texto:'Información complementaria de prueba'})
 const nuevo=await leer(2,200);assert.equal(nuevo.nota.diagnostico,original);assert.equal(nuevo.correcciones[0].autor,'Ana')
 await assert.rejects(operar(3,'corregir',{citaId:200,version:ctx.version,motivo:'Ajena',texto:'Cambiar'}),e=>e.code==='42501')
})
let solicitud
test('orden ambulatoria sin ingreso, solicitud de laboratorio y acceso del paciente correcto',async()=>{
 await db.exec("insert into catalogo_analisis(id,nombre) values(1,'Estudio de prueba')")
 const ctx=await leer(2,200),k=clave(),d={citaId:200,version:ctx.version,tipo:'analisis',analisisId:1,descripcion:'Estudio solicitado',instrucciones:'Indicaciones del prescriptor'}
 const r=await operar(2,'orden',d,k);assert.equal((await operar(2,'orden',d,k)).id,r.id)
 solicitud=(await db.query('select id from solicitudes_analisis where orden_medica_id=$1',[r.id])).rows[0].id
 assert.equal((await db.query('select internacion_id from episodios_medicos where cita_id=200')).rows[0].internacion_id,null)
 assert.equal((await como(6,tx=>tx.query('select clinica_orden($1) p',[r.id]))).rows[0].p,true)
 assert.equal((await como(3,tx=>tx.query('select id from ordenes_medicas where id=$1',[r.id]))).rows.length,0)
 const portal=(await como(6,tx=>tx.query('select clinica_portal_paciente() r'))).rows[0].r
 assert.ok(portal.resultados.some(s=>s.id===solicitud))
})
test('validar laboratorio requiere autorización independiente y la revisión identifica la versión',async()=>{
 await assert.rejects(como(2,tx=>tx.query("update solicitudes_analisis set resultado='Dato',estado_analisis='completado' where id=$1",[solicitud])),e=>e.code==='42501')
 await assert.rejects(como(2,tx=>tx.query('update usuarios set puede_validar_laboratorio=true where id=2')),e=>e.code==='42501')
 await como(1,tx=>tx.query("update solicitudes_analisis set resultado='Dato aprobado por personal autorizado',estado_analisis='completado',fecha_resultado=clock_timestamp() where id=$1",[solicitud]))
 const panel=(await como(2,tx=>tx.query('select clinica_medico_panel() r'))).rows[0].r
 const res=panel.resultados.find(s=>s.id===solicitud);assert.ok(res)
 await operar(2,'revisar',{resultadoId:solicitud,version:res.version,comentario:'Revisión documentada'})
 assert.equal((await como(2,tx=>tx.query('select clinica_medico_panel() r'))).rows[0].r.resultados.length,0)
 await como(1,tx=>tx.query("update solicitudes_analisis set resultado='Resultado actualizado' where id=$1",[solicitud]))
 assert.equal((await como(2,tx=>tx.query('select clinica_medico_panel() r'))).rows[0].r.resultados.length,1)
 await assert.rejects(operar(2,'revisar',{resultadoId:solicitud,version:res.version}),e=>e.code==='40001')
})
test('los médicos colaboradores consultan notas cerradas sin poder modificar notas ni órdenes ajenas',async()=>{
 await db.exec("insert into paciente_medicos(paciente_id,medico_id,tipo,motivo) values(1,2,'colaborador','Colaboración de prueba')")
 assert.equal((await leer(3,200)).puedeEditar,false)
 const o=(await db.query('select orden_medica_id from solicitudes_analisis where id=$1',[solicitud])).rows[0].orden_medica_id
 await assert.rejects(como(3,tx=>tx.query("update ordenes_medicas set instrucciones='Sustituir' where id=$1",[o])),e=>e.code==='42501')
 await assert.rejects(como(2,tx=>tx.query("update citas set estado='pendiente' where id=200")),e=>e.code==='42501')
})
test('el médico coordina cambios mediante recepción conservando la cita y la identidad del paciente',async()=>{
 // Una hora fija del siguiente día evita que la prueba cruce medianoche al ejecutarse por la noche.
 await db.exec("insert into citas(id,paciente_id,medico_id,clinica_id,inicio,fin) select 201,1,1,1,((clock_timestamp() at time zone 'America/Mexico_City')::date+1+time '10:00') at time zone 'America/Mexico_City',((clock_timestamp() at time zone 'America/Mexico_City')::date+1+time '10:20') at time zone 'America/Mexico_City'")
 const ctx=await leer(2,201),datos={citaId:201,version:ctx.version,motivo:'Solicito coordinar otro horario con el paciente'},k=clave()
 await operar(2,'solicitar_cambio',datos,k);await operar(2,'solicitar_cambio',datos,k)
 const solicitudes=(await como(4,tx=>tx.query('select clinica_listar_cambios_cita() r'))).rows[0].r
 const s=solicitudes.find(s=>s.cita_id===201);assert.equal(s.origen,'medico');assert.equal(s.paciente,'Paciente uno');assert.equal(s.solicitante_id,2)
 assert.equal((await db.query('select estado from citas where id=201')).rows[0].estado,'pendiente')
 await assert.rejects(como(2,tx=>tx.query("update citas set inicio=inicio+interval '1 day',fin=fin+interval '1 day' where id=201")),e=>e.code==='42501')
})

