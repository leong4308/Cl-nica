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


let dia,secuencia=15000
const clave=()=>uid(++secuencia)
const rpc=async(n,fn,args=[])=>(await como(n,tx=>tx.query('select '+fn+' r',args))).rows[0].r
const gestion=(n,m,a,d)=>rpc(n,'clinica_operar_modulo($1,$2,$3,$4)',[m,a,JSON.stringify(d),clave()])
const enfermeria=(n,a,d)=>rpc(n,'clinica_enfermeria_operar($1,$2,$3)',[a,JSON.stringify(d),clave()])
const medico=(a,d)=>rpc(2,'clinica_medico_operar($1,$2,$3)',[a,JSON.stringify(d),clave()])
async function avanzar(hora){
 await db.query("update reloj_aceptacion set instante=($1::date+$2::time) at time zone 'America/Mexico_City'",[dia,hora])
 // Simula usuarios que continúan interactuando mientras avanza el reloj del recorrido.
 await db.exec('update sesiones_clinica set ultimo_movimiento=public.reloj_aceptacion(),bloqueada_en=null')
}
const instante=async(fecha,hora)=>(await db.query("select ($1::date+$2::time) at time zone 'America/Mexico_City' t",[fecha,hora])).rows[0].t.toISOString()
async function llegada(n,id,accion){const c=await rpc(n,'clinica_recepcion_estado($1)',[id]);return rpc(n,'clinica_recepcion_operar($1,$2,$3,null,$4)',[id,c.version,accion,clave()])}

test('flujo completo enlaza los cinco roles desde registro e invitación hasta consulta, resultados y control',async t=>{
 let paciente,cita,sala,estudio,consulta,control,cama
 await t.test('administración publica agenda, consultorio y recursos de hospitalización',async()=>{
  await rpc(1,'clinica_guardar_agenda($1,$2,$3)',[1,JSON.stringify(Array.from({length:7},(_,dia)=>({dia,inicio:'08:00',fin:'20:00'}))),'[]'])
  sala=(await gestion(1,'consultorios','sala',{clinicaId:1,nombre:'Consulta de aceptación',ubicacion:'Planta de prueba'})).id
  const hasta=(await db.query('select ($1::date+14)::text d',[dia])).rows[0].d
  for(let d=0;d<7;d++)await gestion(1,'consultorios','turno',{consultorioId:sala,medicoId:1,desde:dia,hasta,dia:d,inicio:'08:00',fin:'20:00'})
  const h=await rpc(1,'clinica_catalogo_camas_operar($1,$2,$3)',['crear_habitacion',JSON.stringify({clinicaId:1,numero:'ACEP',tipo:'General',capacidad:1}),clave()])
  cama=(await rpc(1,'clinica_catalogo_camas_operar($1,$2,$3)',['crear_cama',JSON.stringify({habitacionId:h.id,numero:'A'}),clave()])).id;assert.ok(cama)
 })
 await t.test('recepción registra la ficha y la invitación activa la misma cuenta como paciente',async()=>{
  paciente=(await rpc(4,'clinica_registrar_paciente($1)',[JSON.stringify({nombre:'Paciente de aceptación',correo:'aceptacion@example.test',telefono:'5551234567',fechaNacimiento:'1992-05-14',genero:'F'})])).id
  assert.ok(paciente)
  const invitacion=(await db.query('select clinica_invitacion_preparar($1,$2) r',[paciente,uid(4)])).rows[0].r
  await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,clock_timestamp(),$3)',[uid(12),'aceptacion@example.test',JSON.stringify({cn_invitacion:invitacion.token,rol:'admin'})])
  await db.query('insert into auth.sessions(id,user_id) values($1,$1)',[uid(12)])
  await rpc(12,'clinica_estado_sesion()');const portal=await rpc(12,'clinica_portal_paciente()');assert.equal(portal.perfil.id,paciente)
  assert.equal((await db.query('select rol from usuarios where auth_user_id=$1',[uid(12)])).rows[0].rol,'paciente')
  const directorio=await rpc(4,'clinica_directorio_recepcion()');assert.ok(directorio.some(p=>p.id===paciente));assert.ok(directorio.every(p=>!('notas_medicas' in p)))
 })
 await t.test('recepción agenda con el médico y el paciente confirma; se encolan sus avisos',async()=>{
  cita=(await rpc(4,'clinica_crear_cita($1,$2,$3,$4)',[paciente,1,await instante(dia,'10:00'),'Consulta de aceptación'])).id
  const v=(await db.query('select clinica_version_reserva(c) v from citas c where id=$1',[cita])).rows[0].v
  await rpc(12,'clinica_responder_cita($1,$2,$3)',[cita,v,'confirmar'])
  const c=(await db.query('select estado,consultorio_id from citas where id=$1',[cita])).rows[0];assert.equal(c.estado,'confirmada');assert.equal(c.consultorio_id,sala)
  assert.ok((await db.query('select 1 from correo_envios e join notificaciones n on n.id=e.notificacion_id where n.cita_id=$1',[cita])).rows.length)
 })
 await t.test('enfermería atiende únicamente después de la asignación y recepción registra llegada sin cerrar la cita',async()=>{
  assert.ok(!(await como(5,tx=>tx.query('select id from perfiles_pacientes where id=$1',[paciente]))).rows.length)
  await enfermeria(1,'asignar',{pacienteId:paciente,enfermeroId:1,inicio:await instante(dia,'09:00'),fin:await instante(dia,'20:00'),area:'Consulta'})
  await avanzar('09:55');await llegada(4,cita,'llegada')
  await avanzar('09:58');await enfermeria(5,'signos',{pacienteId:paciente,valores:{sistolica:120,diastolica:80,pulso:72,temperatura:36.5,saturacion:98}})
  assert.equal((await db.query('select estado from citas where id=$1',[cita])).rows[0].estado,'confirmada')
  await assert.rejects(llegada(4,cita,'iniciar'),e=>e.code==='42501')
 })
 await t.test('el médico inicia, documenta, prescribe un estudio y cierra una sola nota con los signos de enfermería',async()=>{
  await avanzar('10:05');await llegada(2,cita,'iniciar')
  const contenido={subjetivo:'Evolución sintética de aceptación',objetivo:'Exploración sintética',diagnostico:'Diagnóstico de prueba',plan:'Indicaciones de prueba',medicamentos:[]}
  consulta=await rpc(2,'clinica_consulta_leer($1)',[cita])
  await medico('guardar',{citaId:cita,version:consulta.version,contenido,cerrar:false})
  consulta=await rpc(2,'clinica_consulta_leer($1)',[cita])
  const o=await medico('orden',{citaId:cita,version:consulta.version,tipo:'analisis',analisisId:1,descripcion:'Estudio de prueba',instrucciones:'Indicaciones sintéticas'})
  estudio=(await db.query('select id from solicitudes_analisis where orden_medica_id=$1',[o.id])).rows[0].id
  await avanzar('10:25');consulta=await rpc(2,'clinica_consulta_leer($1)',[cita]);await medico('guardar',{citaId:cita,version:consulta.version,contenido,cerrar:true})
  consulta=await rpc(2,'clinica_consulta_leer($1)',[cita]);assert.equal(consulta.nota.estado_nota,'cerrada');assert.equal(consulta.signos.valores.pulso,72)
  assert.equal((await db.query('select estado from citas where id=$1',[cita])).rows[0].estado,'atendida')
  await assert.rejects(rpc(4,'clinica_consulta_leer($1)',[cita]),e=>e.code==='42501')
 })
 await t.test('enfermería procesa la muestra; solo personal autorizado valida el resultado y el paciente lo consulta',async()=>{
  assert.ok((await rpc(5,'clinica_enfermeria_panel()')).muestras.some(m=>m.id===estudio));
  await enfermeria(5,'muestra',{pacienteId:paciente,solicitudId:estudio,etapa:'tomada'});await enfermeria(5,'muestra',{pacienteId:paciente,solicitudId:estudio,etapa:'entregada'})
  await assert.rejects(como(2,tx=>tx.query("update solicitudes_analisis set resultado='No autorizado',estado_analisis='completado' where id=$1",[estudio])),e=>e.code==='42501')
  assert.equal(await rpc(1,'clinica_rol()'),'admin')
  // La API de Usuarios aplica esta autorización con el cliente privado del servidor, tras verificar al administrador.
  await db.exec('update usuarios set puede_validar_laboratorio=true where id=2')
  await como(2,tx=>tx.query("update solicitudes_analisis set resultado='Resultado de aceptación',estado_analisis='completado',fecha_resultado=clock_timestamp() where id=$1",[estudio]))
  const r=(await rpc(2,'clinica_medico_panel()')).resultados.find(r=>r.id===estudio);assert.ok(r);await medico('revisar',{resultadoId:estudio,version:r.version,comentario:'Revisión de prueba'})
  const p=await rpc(12,'clinica_portal_paciente()');assert.ok(p.consultas.some(x=>x.id===consulta.nota.id));assert.equal(p.resultados.find(x=>x.id===estudio).resultado,'Resultado de aceptación')
  assert.ok(!(await rpc(7,'clinica_portal_paciente()')).resultados.some(x=>x.id===estudio))
 })
 await t.test('el control indicado no reserva por sí solo; el paciente crea y asocia su cita de seguimiento',async()=>{
  const manana=(await db.query('select ($1::date+1)::text d',[dia])).rows[0].d
  const antes=(await db.query('select count(*)::int n from citas')).rows[0].n
  control=(await gestion(2,'controles','crear',{pacienteId:paciente,citaId:cita,fecha:manana,titulo:'Control de aceptación',indicaciones:'Indicaciones de prueba',diasAviso:1})).id
  assert.equal((await db.query('select count(*)::int n from citas')).rows[0].n,antes)
  const inicio=await instante(manana,'12:00'),fin=await instante(manana,'12:20')
  const nueva=await rpc(12,'clinica_agendar_paciente($1,$2,$3,$4,$5)',[1,inicio,fin,clave(),'Seguimiento de aceptación'])
  const p=(await rpc(12,'clinica_controles_panel()')).controles.find(x=>x.id===control)
  await gestion(12,'controles','vincular_cita',{id:control,version:p.version,citaId:nueva.id})
  assert.equal((await rpc(12,'clinica_controles_panel()')).controles.find(x=>x.id===control).estado,'cita_agendada')
 })
 await t.test('administración recibe asistencia y tiempos reales, con permisos separados para los cinco roles',async()=>{
  const r=await rpc(1,'clinica_reportes_panel($1,$2,null)',[dia,dia]);assert.equal(r.atendidas,1)
  const m=r.porMedico.find(m=>m.id===1);assert.equal(m.espera,10);assert.equal(m.duracion,20);assert.equal(m.muestra_duracion,1)
  for(const n of [2,4,5,12])await assert.rejects(rpc(n,'clinica_reportes_panel($1,$2,null)',[dia,dia]),e=>e.code==='42501')
  assert.ok(!(await como(4,tx=>tx.query('select id from expedientes'))).rows.length)
  await assert.rejects(rpc(7,'clinica_consulta_leer($1)',[cita]),e=>e.code==='42501')
 })
 await t.test('muestras conserva idempotencia y rechaza datos clínicos, órdenes canceladas y roles ajenos',async()=>{
  const ctx=await rpc(2,'clinica_consulta_leer($1)',[cita]),o=await medico('orden',{citaId:cita,version:ctx.version,tipo:'analisis',analisisId:1,descripcion:'Segundo estudio de prueba',instrucciones:'Indicación de prueba'})
  const id=(await db.query('select id from solicitudes_analisis where orden_medica_id=$1',[o.id])).rows[0].id
  const b={pacienteId:paciente,solicitudId:id,etapa:'tomada'},k=clave()
  await assert.rejects(enfermeria(5,'muestra',{...b,etapa:'entregada'}),/Primero/)
  for(const n of [1,2,4,12])await assert.rejects(enfermeria(n,'muestra',b),e=>e.code==='42501')
  await assert.rejects(enfermeria(5,'muestra',{...b,pacienteId:1}),e=>e.code==='42501')
  await assert.rejects(enfermeria(5,'muestra',{...b,resultado:'Falso'}),e=>e.code==='42501')
  const a=await rpc(5,'clinica_enfermeria_operar($1,$2,$3)',['muestra',JSON.stringify(b),k])
  assert.equal((await rpc(5,'clinica_enfermeria_operar($1,$2,$3)',['muestra',JSON.stringify(b),k])).id,a.id)
  await assert.rejects(enfermeria(5,'muestra',b),e=>e.code==='PT409')
  await assert.rejects(rpc(5,'clinica_enfermeria_operar($1,$2,$3)',['muestra',JSON.stringify({...b,texto:'Contenido diferente'}),k]),e=>e.code==='PT409')
  await como(2,tx=>tx.query("update ordenes_medicas set estado='cancelada' where id=$1",[o.id]))
  await assert.rejects(enfermeria(5,'muestra',{...b,etapa:'entregada'}),/no está pendiente/)
  assert.ok(!(await rpc(5,'clinica_enfermeria_panel()')).muestras.some(m=>m.id===id))
 })
 await t.test('el seguimiento de muestras de hospitalización también conserva la asignación y las etapas',async()=>{
  const i=await rpc(2,'clinica_hospital($1,$2)',[null,JSON.stringify({accion:'crear',pacienteId:paciente,medicoId:1,camaId:cama,motivo:'Observación de prueba'})])
  const ep=(await db.query('select id from episodios_medicos where internacion_id=$1',[i.id])).rows[0].id
  const o=(await como(2,tx=>tx.query("insert into ordenes_medicas(episodio_id,tipo_orden,descripcion,instrucciones) values($1,'analisis','Estudio hospitalario de prueba','Indicaciones de prueba') returning id",[ep]))).rows[0].id
  for(const n of [3,4,5,12]) await assert.rejects(como(n,tx=>tx.query("insert into ordenes_medicas(episodio_id,tipo_orden,descripcion) values($1,'analisis','Sin autorización') returning id",[ep])),e=>e.code==='42501')
  const id=(await como(2,tx=>tx.query('insert into solicitudes_analisis(orden_medica_id,analisis_id) values($1,1) returning id',[o]))).rows[0].id
  assert.ok((await rpc(5,'clinica_enfermeria_panel()')).muestras.some(m=>m.id===id))
  await enfermeria(5,'muestra',{pacienteId:paciente,solicitudId:id,etapa:'tomada'})
  await enfermeria(5,'muestra',{pacienteId:paciente,solicitudId:id,etapa:'entregada'})
  assert.ok((await db.query('select fecha_toma_muestra from solicitudes_analisis where id=$1',[id])).rows[0].fecha_toma_muestra)
  await avanzar('20:01');assert.equal((await rpc(5,'clinica_enfermeria_panel()')).muestras.length,0)
  await assert.rejects(enfermeria(5,'muestra',{pacienteId:paciente,solicitudId:id,etapa:'tomada'}),e=>e.code==='42501')
 })

 await t.test('la prórroga anual usa la RPC administrativa y conserva horarios, permisos e idempotencia',async()=>{
  const sala2=(await gestion(1,'consultorios','sala',{clinicaId:1,nombre:'Sala de prórroga',ubicacion:''})).id
  const fechas=(await db.query('select ($1::date+365)::text original,($1::date+379)::text hasta,($1::date+733)::text excesiva',[dia])).rows[0]
  const original=(await gestion(1,'consultorios','turno',{consultorioId:sala2,medicoId:2,desde:dia,hasta:fechas.original,dia:0,inicio:'08:00',fin:'20:00'})).id
  const p=await rpc(1,'clinica_consultorios_panel()'),version=p.turnos.find(t=>t.id===original).version
  const datos={id:original,version,hasta:fechas.hasta},k=clave()
  for(const n of [2,4,5,12])await assert.rejects(gestion(n,'consultorios','prorrogar_turno',datos),e=>e.code==='42501')
  await assert.rejects(gestion(1,'consultorios','prorrogar_turno',{...datos,version:'0'.repeat(32)}),e=>e.code==='PT409')
  await assert.rejects(gestion(1,'consultorios','prorrogar_turno',{...datos,hasta:fechas.original}),/continuación/)
  await assert.rejects(gestion(1,'consultorios','prorrogar_turno',{...datos,hasta:fechas.excesiva}),/continuación/)
  await assert.rejects(gestion(1,'consultorios','prorrogar_turno',{...datos,medicoId:1}),/solo admite/)
  const n=await rpc(1,'clinica_operar_modulo($1,$2,$3,$4)',['consultorios','prorrogar_turno',JSON.stringify(datos),k])
  assert.equal((await rpc(1,'clinica_operar_modulo($1,$2,$3,$4)',['consultorios','prorrogar_turno',JSON.stringify(datos),k])).id,n.id)
  await assert.rejects(gestion(1,'consultorios','prorrogar_turno',datos),e=>e.code==='23P01')
  const nuevo=(await rpc(4,'clinica_consultorios_panel()')).turnos.find(t=>t.id===n.id)
  assert.equal(nuevo.hasta,fechas.hasta);assert.equal(nuevo.medicoId,2);assert.equal(nuevo.consultorioId,sala2)
  assert.equal(nuevo.inicio,'08:00:00');assert.equal(nuevo.fin,'20:00:00');assert.equal(nuevo.dia,0)
  assert.equal((await rpc(1,'clinica_consultorios_panel()')).turnos.find(t=>t.id===original).hasta,fechas.original)
  await assert.rejects(rpc(1,'clinica_consultorios_mutar($1,$2)',['prorrogar_turno',JSON.stringify(datos)]),e=>e.code==='42501')
 })

})
