import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { conexionSQL, entorno } from './entorno-operacion.mjs'
import { respuestasInstaladasManualmente } from '../lib/operacion/migracion-manual.mjs'
const env=entorno(), db=conexionSQL(env.SUPABASE_DB_URL,env)
try {
  await db.connect()
  await db.query('select pg_advisory_lock(37200,0)')
  await db.query('create schema if not exists clinica_admin; revoke all on schema clinica_admin from public,anon,authenticated; create table if not exists clinica_admin.migraciones(nombre text primary key,hash text not null,fecha timestamptz not null default now())')
  for(const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql','020_notificaciones.sql','021_telegram_desvinculacion.sql','022_portal_paciente.sql','023_resultados_publicados_paciente.sql','024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql','030_recepcion.sql','031_consulta_medica.sql','032_administracion_camas.sql','033_portal_y_correo.sql','034_correo_paciente.sql','035_consultorios.sql','036_espera_y_controles.sql','037_comunicaciones_y_reportes.sql','038_datos_personales_paciente.sql','039_conflicto_perfil.sql','040_muestras_ambulatorias.sql','041_lectura_orden_insertada.sql']){
    const sql=readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'),hash=createHash('sha256').update(sql).digest('hex')
    const previa=await db.query('select hash from clinica_admin.migraciones where nombre=$1',[nombre])
    if(previa.rows.length){if(previa.rows[0].hash!==hash)throw Error('La migración ya aplicada cambió. Crea una nueva migración.');console.log(nombre+': ya aplicada');continue}
    const manual = ['024_respuestas_citas.sql','025_telegram_https.sql','026_reagenda_turnos.sql','027_autogestion_y_sesiones.sql','028_enfermeria.sql','029_controles_enfermeria.sql'].includes(nombre) && await respuestasInstaladasManualmente(db,sql)
    if (!manual) await db.query(sql)
    await db.query('insert into clinica_admin.migraciones(nombre,hash) values($1,$2)',[nombre,hash])
    console.log(nombre+(manual?': instalación manual verificada y hash registrado':': aplicada correctamente'))
  }
}catch(e){console.error('No se completó la actualización. Código: '+(e.code??'CONFIGURACION')+'. '+(['23P01','23505'].includes(e.code)?'Existen citas o ingresos en conflicto; no se borraron registros.':e.code?'Revisa la conexión, los permisos SQL y el archivo de migración.':e.message));process.exitCode=1}
finally{await db.end()}
