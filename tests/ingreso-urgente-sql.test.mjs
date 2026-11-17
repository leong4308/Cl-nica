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
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql','034_correo_paciente.sql','035_consultorios.sql','036_espera_y_controles.sql','037_comunicaciones_y_reportes.sql','038_datos_personales_paciente.sql','039_conflicto_perfil.sql','040_muestras_ambulatorias.sql','041_lectura_orden_insertada.sql','042_prorroga_consultorios.sql','043_registro_publico_paciente.sql','044_validacion_contactos.sql','045_comunicacion_equipo.sql','046_eliminaciones_administrador.sql','047_ingreso_urgente_enfermeria.sql','048_enfermeria_censo_y_selector.sql']) { try { await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8').replaceAll('clock_timestamp()', 'public.reloj_aceptacion()')) } catch(e){throw Error(nombre+': '+e.message+' '+(e.where??'')+' '+(e.position??''))} }
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

const solicitud = (pacienteId=1,camaId=1) => ({pacienteId,medicoId:1,camaId,motivo:'Requiere observación hospitalaria',observaciones:'Se recibe para valoración por el médico.',confirmado:true})
test('el buscador de admisión solo devuelve identificación mínima, sin exigir turno ni abrir historia ajena',async()=>{
 await rpc(5,'clinica_estado_sesion()')
 const vacio=await rpc(5,'clinica_enfermeria_ingresos_panel($1)',[''])
 assert.equal(vacio.pacientes.length,3);assert.equal(vacio.camas.length,2);assert.equal(vacio.medicos.length,2)
 const busqueda=await rpc(5,'clinica_enfermeria_ingresos_panel($1)',['PAC-00001'])
 assert.equal(busqueda.pacientes.length,1);assert.deepEqual(Object.keys(busqueda.pacientes[0]).sort(),['id','ingresoActivo','nombre'])
 assert.equal(await rpc(5,'clinica_paciente($1)',[1]),false)
 for(const n of [1,2,4,6]){await rpc(n,'clinica_estado_sesion()');await assert.rejects(rpc(n,'clinica_enfermeria_ingresos_panel($1)',['Paciente']),e=>e.code==='42501')}
})
test('el ingreso exige confirmación y un médico y cama de la clínica del enfermero',async()=>{
 const b=solicitud()
 await assert.rejects(rpc(5,'clinica_enfermeria_ingreso_registrar($1,$2)',[{...b,confirmado:false},uid(101)]),e=>e.code==='23514')
 await db.exec("insert into clinicas(id,nombre) values(2,'Otra'); insert into habitaciones(id,clinica_id,numero,tipo,capacidad) values(2,2,'201','General',1);insert into camas(id,habitacion_id,numero) values(3,2,'C')")
 await assert.rejects(rpc(5,'clinica_enfermeria_ingreso_registrar($1,$2)',[{...b,camaId:3},uid(101)]),e=>e.code==='42501')
 await db.exec('update camas set habilitada=false where id=2')
 await assert.rejects(rpc(5,'clinica_enfermeria_ingreso_registrar($1,$2)',[{...b,camaId:2},uid(101)]),e=>e.code==='PT409')
 await db.exec('update camas set habilitada=true where id=2')
 assert.equal((await db.query('select count(*)::int n from internaciones')).rows[0].n,0)
})
test('registrar ocupa cama y crea episodio y avisos, y reintentar no duplica ni concede acceso a expedientes',async()=>{
 const b=solicitud(),r=await rpc(5,'clinica_enfermeria_ingreso_registrar($1,$2)',[b,uid(102)])
 assert.ok(r.id);assert.deepEqual(await rpc(5,'clinica_enfermeria_ingreso_registrar($1,$2)',[b,uid(102)]),r)
 assert.equal((await db.query('select count(*)::int n from internaciones')).rows[0].n,1)
 assert.equal((await db.query('select esta_ocupada from camas where id=1')).rows[0].esta_ocupada,true)
 assert.equal((await db.query('select diagnostico_ingreso from internaciones where id=$1',[r.id])).rows[0].diagnostico_ingreso,'')
 const ep=(await db.query('select * from episodios_medicos where internacion_id=$1',[r.id])).rows[0]
 assert.match(ep.descripcion,/Observaciones de enfermería/);assert.equal(ep.otros_signos.auditoria.usuarioId,5)
 assert.ok((await db.query("select count(*)::int n from notificaciones where usuario_id=2 and tipo='internaciones'")).rows[0].n>0)
 assert.equal((await db.query("select count(*)::int n from notificaciones where usuario_id=4 and tipo='ingreso_urgente'")).rows[0].n,1)
 assert.equal(await rpc(5,'clinica_paciente($1)',[1]),false)
 assert.equal((await rpc(5,'clinica_enfermeria_ingresos_panel($1)',['PAC-00001'])).pacientes.length,0)
 assert.equal((await db.query('select count(*)::int n from enfermeria_turnos')).rows[0].n,0)
 await assert.rejects(rpc(5,'clinica_enfermeria_ingreso_registrar($1,$2)',[{...b,motivo:'Otros datos'},uid(102)]),e=>e.code==='40001')
})
test('impide hospitalización duplicada y cama ocupada aun con otra clave; paciente y recepción no registran ingresos',async()=>{
 for(const b of [solicitud(1,2),solicitud(2,1)])await assert.rejects(rpc(5,'clinica_enfermeria_ingreso_registrar($1,$2)',[b,uid(103)]),e=>e.code==='PT409')
 for(const n of [1,2,4,6])await assert.rejects(rpc(n,'clinica_enfermeria_ingreso_registrar($1,$2)',[solicitud(2,2),uid(103)]),e=>e.code==='42501')
 await assert.rejects(como(5,tx=>tx.exec('select * from enfermeria_ingresos_recibos')),e=>e.code==='42501')
 assert.equal((await db.query('select count(*)::int n from internaciones')).rows[0].n,1)
})

test('el censo de enfermería muestra ocupante y médico de su clínica sin diagnósticos, expedientes ni camas ajenas',async()=>{
 const panel=await rpc(5,'clinica_enfermeria_panel()')
 assert.equal(panel.mapaCamas.length,2);assert.equal(panel.resumenCamas.ocupadas,1);assert.equal(panel.resumenCamas.libres,1)
 const cama=panel.mapaCamas.find(c=>c.id===1)
 assert.equal(cama.ocupante.paciente,'Paciente uno');assert.equal(cama.ocupante.medico,'Ana');assert.equal(cama.ocupante.asignado,false)
 assert.deepEqual(Object.keys(cama.ocupante).sort(),['asignado','fechaIngreso','id','medico','medicoId','paciente','pacienteId'])
 assert.deepEqual(panel.ingresos,[]);assert.deepEqual(panel.pacientes,[]);assert.deepEqual(panel.registros,[])
 assert.equal(panel.mapaCamas.some(c=>c.id===3),false)
})
const clave=n=>uid(1000+n)
const operar=async(n,accion,datos,k)=>rpc(n,'clinica_equipo_operar($1,$2::jsonb,$3)',[accion,JSON.stringify(datos),k])
let hilo

