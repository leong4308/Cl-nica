import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { conexionSQL, entorno } from './entorno-operacion.mjs'
const env=entorno(), db=conexionSQL(env.SUPABASE_DB_URL,env)
try {
  await db.connect()
  await db.query('select pg_advisory_lock(37200,0)')
  await db.query('create schema if not exists clinica_admin; revoke all on schema clinica_admin from public,anon,authenticated; create table if not exists clinica_admin.migraciones(nombre text primary key,hash text not null,fecha timestamptz not null default now())')
  for(const nombre of ['018_seguridad_y_auditoria.sql','019_transacciones_clinicas.sql']){
    const sql=readFileSync(new URL('../supabase/migraciones/'+nombre,import.meta.url),'utf8'),hash=createHash('sha256').update(sql).digest('hex')
    const previa=await db.query('select hash from clinica_admin.migraciones where nombre=$1',[nombre])
    if(previa.rows.length){if(previa.rows[0].hash!==hash)throw Error('La migración ya aplicada cambió. Crea una nueva migración.');console.log(nombre+': ya aplicada');continue}
    await db.query(sql)
    await db.query('insert into clinica_admin.migraciones(nombre,hash) values($1,$2)',[nombre,hash])
    console.log(nombre+': aplicada correctamente')
  }
}catch(e){console.error('No se completó la actualización. Código: '+(e.code??'CONFIGURACION')+'. '+(['23P01','23505'].includes(e.code)?'Existen citas o ingresos en conflicto; no se borraron registros.':e.code?'Revisa la conexión, los permisos SQL y el archivo de migración.':e.message));process.exitCode=1}
finally{await db.end()}
