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
  for (const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql','034_correo_paciente.sql','035_consultorios.sql','036_espera_y_controles.sql','037_comunicaciones_y_reportes.sql']) { try { await db.exec(readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8')) } catch(e){throw Error(nombre+': '+e.message+' '+(e.where??'')+' '+(e.position??''))} }
  await prepararDatosGestion()
})
after(async()=>{ await db?.close() })
async function como(n, fn, sid = uid(n)) {
  return db.transaction(async tx => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:uid(n),session_id:sid,role:'authenticated'})}',true)`)
    return fn(tx)
  })
}
let secuencia=10000
const clave=()=>uid(++secuencia)
const operar=async(n,modulo,accion,datos,k=clave())=>(await como(n,tx=>tx.query('select clinica_operar_modulo($1,$2,$3,$4) r',[modulo,accion,JSON.stringify(datos),k]))).rows[0].r
const panel=async(n,modulo)=>(await como(n,tx=>tx.query(`select clinica_${modulo}_panel() r`))).rows[0].r
let dia,dia2,dow,sala,turno,citaA,inicio,fin,solicitud,oferta,control
async function prepararDatosGestion(){
 const d=(await db.query("select (clock_timestamp() at time zone 'America/Mexico_City')::date+2 dia,extract(dow from (clock_timestamp() at time zone 'America/Mexico_City')::date+2)::int dow")).rows[0]
 dia=String(d.dia).slice(0,10);dow=d.dow
 // PGlite devuelve DATE como YYYY-MM-DD.
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))dia=new Date(d.dia).toISOString().slice(0,10)
 dia2=(await db.query('select ($1::date+7)::text d',[dia])).rows[0].d
 inicio=dia+'T16:00:00Z';fin=dia+'T16:20:00Z'
 await db.query("insert into configuracion_agenda(medico_id,bloques,descansos) values(1,$1,'[]'),(2,$1,'[]')",[JSON.stringify([{dia:dow,inicio:'08:00',fin:'20:00'}])])
 await db.exec("select setval(pg_get_serial_sequence('citas','id'),(select max(id) from citas))")
}
test('interfaces y acciones nuevas respetan roles y sesiones',async()=>{
 assert.equal((await db.query('select clinica_version() v')).rows[0].v,37)
 assert.ok((await panel(1,'consultorios')).salas)
 await assert.rejects(panel(2,'consultorios'),e=>e.code==='42501')
 await assert.rejects(panel(5,'espera'),e=>e.code==='42501')
 await assert.rejects(panel(4,'controles'),e=>e.code==='42501')
 await assert.rejects(operar(4,'consultorios','sala',{clinicaId:1,nombre:'Sala',ubicacion:''}),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query('select * from lista_espera')),e=>e.code==='42501')
})
test('consultorios y turnos tienen capacidad única, vigencia y guardado idempotente',async()=>{
 const k=clave(),d={clinicaId:1,nombre:'Consultorio A',ubicacion:'Planta de prueba'}
 sala=(await operar(1,'consultorios','sala',d,k)).id
 assert.equal((await operar(1,'consultorios','sala',d,k)).id,sala)
 await assert.rejects(operar(1,'consultorios','sala',{...d,nombre:'Otro'},k),e=>e.code==='40001')
 turno=(await operar(1,'consultorios','turno',{consultorioId:sala,medicoId:1,desde:dia,hasta:dia2,dia:dow,inicio:'08:00',fin:'14:00'})).id
 await assert.rejects(operar(1,'consultorios','turno',{consultorioId:sala,medicoId:2,desde:dia,hasta:dia2,dia:dow,inicio:'10:00',fin:'16:00'}),e=>e.code==='23P01')
 const libres=(await como(6,tx=>tx.query('select clinica_agenda_reserva(1,$1) r',[dia]))).rows[0].r.turnos
 assert.ok(libres.some(t=>Date.parse(t.inicio)===Date.parse(inicio)));assert.ok(libres.every(t=>Date.parse(t.fin)<=Date.parse(dia+'T20:00:00Z')))
})
test('la reserva asigna consultorio y protege turnos con citas vigentes',async()=>{
 const r=(await como(6,tx=>tx.query('select clinica_agendar_paciente(1,$1,$2,$3,$4) r',[inicio,fin,clave(),'Consulta de prueba']))).rows[0].r
 citaA=r.id
 assert.equal((await db.query('select consultorio_id from citas where id=$1',[citaA])).rows[0].consultorio_id,sala)
 const t=(await panel(1,'consultorios')).turnos.find(t=>t.id===turno)
 await assert.rejects(operar(1,'consultorios','baja_turno',{id:t.id,version:t.version}),/vigentes/)
 await assert.rejects(como(6,tx=>tx.query('select clinica_agendar_paciente(1,$1,$2,$3,$4)',[''+dia+'T21:00:00Z',''+dia+'T21:20:00Z',clave(),'Fuera de sala'])),e=>e.code==='23P01')
})
test('lista de espera no reserva; una oferta identifica al paciente y acepta una sola vez',async()=>{
 solicitud=(await operar(1,'espera','inscribir',{pacienteId:2,medicoId:1,desde:dia,hasta:dia2,inicio:'08:00',fin:'14:00'})).id
 const l=(await panel(4,'espera')).solicitudes.find(l=>l.id===solicitud)
 const antes=(await db.query('select count(*)::int n from citas')).rows[0].n
 oferta=(await operar(4,'espera','ofertar',{id:l.id,version:l.version,inicio:dia+'T17:00:00Z'})).id
 assert.equal((await db.query('select count(*)::int n from citas')).rows[0].n,antes)
 await assert.rejects(operar(6,'espera','aceptar',{ofertaId:oferta}),e=>e.code==='42501')
 const a=await operar(7,'espera','aceptar',{ofertaId:oferta});const b=await operar(7,'espera','aceptar',{ofertaId:oferta})
 assert.equal(a.id,b.id);assert.equal((await db.query('select count(*)::int n from citas')).rows[0].n,antes+1)
})
test('el paciente conserva su reserva si otro ocupa el turno',async()=>{
 const s=(await operar(6,'espera','inscribir',{pacienteId:2,medicoId:1,citaId:citaA,desde:dia,hasta:dia2,inicio:'08:00',fin:'14:00'})).id
 const l=(await panel(6,'espera')).solicitudes.find(l=>l.id===s)
 assert.equal(l.pacienteId,1)
 const o=(await operar(4,'espera','ofertar',{id:l.id,version:l.version,inicio:dia+'T15:00:00Z'})).id
 await db.query("insert into citas(paciente_id,medico_id,clinica_id,inicio,fin) values(3,1,1,$1,$2)",[dia+'T15:00:00Z',dia+'T15:20:00Z'])
 await assert.rejects(operar(6,'espera','aceptar',{ofertaId:o}),e=>e.code==='23P01')
 assert.equal((await db.query('select inicio from citas where id=$1',[citaA])).rows[0].inicio.toISOString(),inicio.replace('Z','.000Z'))
})
test('médico programa controles propios sin crear una cita; paciente y recepción no prescriben controles',async()=>{
 const antes=(await db.query('select count(*)::int n from citas')).rows[0].n
 control=(await operar(2,'controles','crear',{pacienteId:1,citaId:100,fecha:dia,titulo:'Control indicado',indicaciones:'Seguimiento de prueba',diasAviso:1})).id
 assert.equal((await db.query('select count(*)::int n from citas')).rows[0].n,antes)
 await assert.rejects(operar(3,'controles','crear',{pacienteId:1,fecha:dia,titulo:'Ajeno'}),e=>e.code==='42501')
 await assert.rejects(operar(6,'controles','crear',{pacienteId:1,fecha:dia,titulo:'No autorizado'}),e=>e.code==='42501')
 assert.equal((await panel(6,'controles')).controles[0].id,control)
 assert.equal((await panel(7,'controles')).controles.length,0)
})
test('reportes solo administrativos usan muestras reales y conservan ceros sin inventar tiempos',async()=>{
 const r=(await como(1,tx=>tx.query('select clinica_reportes_panel($1,$2,null) r',['2026-01-01','2026-01-03']))).rows[0].r
 assert.equal(r.total,2);assert.equal(r.atendidas,2);assert.equal(r.porDia.length,3);assert.equal(r.porMedico[0].espera,null)
 await assert.rejects(como(4,tx=>tx.query('select clinica_reportes_panel($1,$2,null)',['2026-01-01','2026-01-03'])),e=>e.code==='42501')
})


test('cancelar ofrece el hueco por orden; rechazar pasa al siguiente sin crear reservas',async()=>{
 const preferencias={medicoId:2,desde:dia,hasta:dia2,inicio:'08:00',fin:'20:00'}
 const a=(await operar(6,'espera','inscribir',preferencias)).id,b=(await operar(7,'espera','inscribir',preferencias)).id
 const c=(await db.query("insert into citas(paciente_id,medico_id,clinica_id,inicio,fin) values(3,2,1,$1,$2) returning id",[dia+'T18:00:00Z',dia+'T18:20:00Z'])).rows[0].id
 await db.query("update citas set estado='cancelada_medico' where id=$1",[c])
 const primera=(await panel(6,'espera')).ofertas.find(o=>o.entradaId===a&&o.estado==='pendiente')
 assert.ok(primera);assert.equal((await panel(7,'espera')).ofertas.some(o=>o.entradaId===b&&o.estado==='pendiente'),false)
 const antes=(await db.query('select count(*)::int n from citas')).rows[0].n
 await operar(6,'espera','rechazar',{ofertaId:primera.id})
 const siguiente=(await panel(7,'espera')).ofertas.find(o=>o.entradaId===b&&o.estado==='pendiente');assert.ok(siguiente)
 await db.query("update espera_ofertas set vence_en=clock_timestamp()-interval '1 minute' where id=$1",[siguiente.id])
 await assert.rejects(operar(7,'espera','aceptar',{ofertaId:siguiente.id}),e=>e.code==='40001')
 await db.query('select clinica_generar_recordatorios()')
 assert.equal((await db.query('select estado from espera_ofertas where id=$1',[siguiente.id])).rows[0].estado,'vencida')
 assert.equal((await db.query('select count(*)::int n from citas')).rows[0].n,antes)
})

test('el límite de dos horas se revalida al aceptar una oferta emitida antes',async()=>{
 const c=await db.transaction(async tx=>{const agenda=(await tx.query('select bloques from configuracion_agenda where medico_id=2')).rows[0].bloques;await tx.exec("update configuracion_agenda set bloques='[]' where medico_id=2");const id=(await tx.query("with ahora as materialized(select clock_timestamp() t) insert into citas(paciente_id,medico_id,clinica_id,inicio,fin) select 3,2,1,t+interval '90 minutes',t+interval '110 minutes' from ahora returning id")).rows[0].id;await tx.query('update configuracion_agenda set bloques=$1 where medico_id=2',[JSON.stringify(agenda)]);return id})
 // Representa una oferta emitida cuando faltaban más de dos horas, antes de avanzar el reloj.
 const l=(await db.query("insert into lista_espera(paciente_id,medico_id,cita_id,desde,hasta,inicio,fin,autor) values(3,2,$1,current_date,current_date+7,'08:00','20:00',1) returning id",[c])).rows[0].id
 const o=(await db.query("insert into espera_ofertas(entrada_id,medico_id,inicio,fin,vence_en,cita_version) select $1,2,clock_timestamp()+interval '30 minutes',clock_timestamp()+interval '50 minutes',clock_timestamp()+interval '20 minutes',clinica_version_reserva(c) from citas c where id=$2 returning id",[l,c])).rows[0].id
 await assert.rejects(db.query("select clinica_espera_responder_actor(8,$1,'aceptar','aplicacion')",[o]),/ya no permite adelantarse/)
 assert.equal((await db.query('select estado from espera_ofertas where id=$1',[o])).rows[0].estado,'pendiente')
})

test('Telegram exige vínculo actual y propietario; la aceptación es idempotente',async()=>{
 await db.exec("insert into telegram_cuentas(usuario_id,chat_id,nombre) values(6,606,'Prueba')")
 const l=(await panel(6,'espera')).solicitudes.find(x=>x.medicoId===2&&x.estado==='activa')
 const o=(await operar(4,'espera','ofertar',{id:l.id,version:l.version,inicio:dia+'T18:40:00Z'})).id
 await assert.rejects(db.query("select clinica_responder_espera_telegram(707,$1,'aceptar')",[o]),e=>e.code==='42501')
 await db.exec("update telegram_cuentas set vinculado_en=clock_timestamp()+interval '1 second' where usuario_id=6")
 await assert.rejects(db.query("select clinica_responder_espera_telegram(606,$1,'aceptar')",[o]),e=>e.code==='42501')
 await db.query('update espera_ofertas set telegram_vinculado_en=(select vinculado_en from telegram_cuentas where usuario_id=6) where id=$1',[o])
 const a=(await db.query("select clinica_responder_espera_telegram(606,$1,'aceptar') r",[o])).rows[0].r
 const b=(await db.query("select clinica_responder_espera_telegram(606,$1,'aceptar') r",[o])).rows[0].r
 assert.equal(a.id,b.id)
 await assert.rejects(como(6,tx=>tx.query("select clinica_responder_espera_telegram(606,$1,'aceptar')",[o])),e=>e.code==='42501')
})

test('controles emiten un recordatorio sin citas y se vinculan solo a reservas propias del mismo médico',async()=>{
 await db.query("update controles_seguimiento set fecha=(clock_timestamp() at time zone 'America/Mexico_City')::date,creado_en=clock_timestamp()-interval '10 minutes' where id=$1",[control])
 const antes=(await db.query('select count(*)::int n from citas')).rows[0].n
 await db.exec("select clinica_generar_recordatorios(((clock_timestamp() at time zone 'America/Mexico_City')::date+time '23:59') at time zone 'America/Mexico_City')")
 const n=(await db.query('select count(*)::int n from notificaciones where seguimiento_id=$1',[control])).rows[0].n
 await db.exec("select clinica_generar_recordatorios(((clock_timestamp() at time zone 'America/Mexico_City')::date+time '23:59') at time zone 'America/Mexico_City')")
 assert.equal((await db.query('select count(*)::int n from notificaciones where seguimiento_id=$1',[control])).rows[0].n,n)
 assert.equal((await db.query('select count(*)::int n from citas')).rows[0].n,antes)
 let c=(await panel(6,'controles')).controles.find(x=>x.id===control)
 await assert.rejects(operar(7,'controles','vincular_cita',{id:c.id,version:c.version,citaId:citaA}),e=>e.code==='42501')
 await assert.rejects(operar(6,'controles','vincular_cita',{id:c.id,version:c.version,citaId:101}),/cita/)
 await operar(6,'controles','vincular_cita',{id:c.id,version:c.version,citaId:citaA})
 assert.equal((await panel(6,'controles')).controles.find(x=>x.id===control).estado,'cita_agendada')
 await db.query("update citas set estado='cancelada_medico' where id=$1",[citaA])
 assert.equal((await panel(6,'controles')).controles.find(x=>x.id===control).estado,'pendiente')
})

test('reintentos limitados respetan vigencia, consentimiento y evitan envíos en curso o aceptados',async()=>{
 const n=(await db.query("insert into notificaciones(usuario_id,tipo,titulo,mensaje,clave,seguimiento_id) values(6,'seguimiento','Aviso','Revisa tu control','retry-gestion',$1) returning id",[control])).rows[0].id
 const e=(await db.query('select id from correo_envios where notificacion_id=$1',[n])).rows[0].id
 await assert.rejects(operar(2,'envios','reintentar',{id:e,canal:'correo'}),e=>e.code==='42501')
 await db.query("update correo_envios set estado='enviando' where id=$1",[e]);await assert.rejects(operar(4,'envios','reintentar',{id:e,canal:'correo'}),/no permite/)
 await db.query("update correo_envios set estado='enviado' where id=$1",[e]);await assert.rejects(operar(4,'envios','reintentar',{id:e,canal:'correo'}),/no permite/)
 await db.query("update correo_envios set estado='fallido' where id=$1",[e])
 for(let i=0;i<3;i++)await operar(4,'envios','reintentar',{id:e,canal:'correo'})
 await assert.rejects(operar(4,'envios','reintentar',{id:e,canal:'correo'}),/no permite/)
 await db.query('update correo_envios set reintentos_manuales=0 where id=$1',[e]);await db.exec('update usuarios set correo_citas=false where id=6')
 await assert.rejects(operar(4,'envios','reintentar',{id:e,canal:'correo'}),/desactivados/)
 await db.exec('update usuarios set correo_citas=true where id=6');await db.query("update notificaciones set creado_en=clock_timestamp()-interval '24 hours' where id=$1",[n])
 await assert.rejects(operar(1,'envios','reintentar',{id:e,canal:'correo'}),/venció/)
})

test('ubicaciones solo amplían citas previamente autorizadas; módulos privados no admiten acceso directo',async()=>{
 const propio=(await como(6,tx=>tx.query('select clinica_portal_paciente() r'))).rows[0].r
 assert.ok(propio.citas.some(c=>c.id===citaA&&c.consultorio==='Consultorio A · Planta de prueba'))
 assert.ok(propio.citas.every(c=>c.id!==101))
 for(const t of ['consultorios','consultorio_turnos','lista_espera','espera_ofertas','controles_seguimiento','gestion_operaciones'])await assert.rejects(como(4,tx=>tx.query('select * from '+t)),e=>e.code==='42501')
 await assert.rejects(como(6,tx=>tx.query('select clinica_controles_panel()'),uid(99)),/sesión/i)
})


test('reportes calculan espera y consulta desde marcas coincidentes y muestran el tamaño real de muestra',async()=>{
 await db.query("insert into recepcion_llegadas(cita_id,inicio_cita,llegada,en_consulta,autor,clave) values(100,'2026-01-01 10:00Z','2026-01-01 09:40Z','2026-01-01 09:55Z',4,gen_random_uuid())")
 // Historia importada: completar las marcas de cierre en el fixture, no a través de una edición clínica.
 await db.transaction(async tx=>{await tx.exec('alter table expedientes disable trigger user');await tx.exec("update expedientes set cerrada_en='2026-01-01 10:17Z' where id=100");await tx.exec('alter table expedientes enable trigger user')})
 const r=(await como(1,tx=>tx.query('select clinica_reportes_panel($1,$2,1) r',['2026-01-01','2026-01-03']))).rows[0].r
 assert.equal(r.total,1);assert.equal(r.porMedico[0].espera,15);assert.equal(r.porMedico[0].duracion,22)
 assert.equal(r.porMedico[0].muestra_espera,1);assert.equal(r.porMedico[0].muestra_duracion,1)
})
