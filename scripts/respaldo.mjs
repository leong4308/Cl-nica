import { mkdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createHash,randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { entorno,entornoPostgres,conexionSQL } from './entorno-operacion.mjs'
import { claveRespaldo,escribirRespaldo,verificarRespaldo,leerRespaldo } from '../lib/operacion/respaldo.mjs'
const env=entorno(),accion=process.argv[2]??'crear',ruta=process.argv[3]
let clave
function proceso(bin,args,url){const p=spawn(bin,args,{env:entornoPostgres(url),stdio:['pipe','pipe','pipe'],windowsHide:true});let fallo;p.on('error',e=>{fallo=e});p.stderr.resume();const salida=new Promise((ok,rechazar)=>{p.on('close',codigo=>codigo===0?ok():rechazar(Error(fallo?'Instala las herramientas de PostgreSQL o configura PG_DUMP_BIN / PG_RESTORE_BIN.':'La herramienta PostgreSQL falló. Revisa conexión, certificados y compatibilidad de versiones.')))});salida.catch(()=>{});return{p,salida}}
function storage(url,key){if(!url||!key)throw Error('Configura las credenciales del almacenamiento.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).storage}
async function* documentos(s,bucket,prefijo=''){
 for(let offset=0;;offset+=100){const r=await s.from(bucket).list(prefijo,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(r.error)throw Error('No se pudo listar el almacenamiento.');for(const f of r.data){const ruta=prefijo?prefijo+'/'+f.name:f.name;if(f.id===null){yield* documentos(s,bucket,ruta);continue}const contenido=await s.from(bucket).download(ruta);if(contenido.error)throw Error('No se pudo respaldar un documento.');const b=Buffer.from(await contenido.data.arrayBuffer());yield{tipo:'archivo',bucket,ruta,datos:b.toString('base64'),sha256:createHash('sha256').update(b).digest('hex')}}if(r.data.length<100)break}
}
async function crear(){
 if(!env.SUPABASE_DB_URL)throw Error('Configura SUPABASE_DB_URL.')
 const s=storage(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY),buckets=await s.listBuckets();if(buckets.error)throw Error('No se pudo consultar el almacenamiento.')
 const carpeta=resolve(env.BACKUP_DIR??'respaldos');await mkdir(carpeta,{recursive:true,mode:0o700});const destino=resolve(carpeta,`clinica-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.cnbak`)
 async function* registros(){
  yield{tipo:'manifiesto',version:1,creado:new Date().toISOString(),proyecto:env.NEXT_PUBLIC_SUPABASE_URL,alcance:'public+auth+storage',formato:'postgres-custom'}
  const {p,salida}=proceso(env.PG_DUMP_BIN??'pg_dump',['--format=custom','--no-owner','--no-publications','--no-subscriptions','--schema=public','--schema=auth','--schema=storage'],env.SUPABASE_DB_URL)
  p.stdin.end();let bytes=0,archivos=0;const hash=createHash('sha256')
  try{for await(const b of p.stdout){hash.update(b);bytes+=b.length;yield{tipo:'db',datos:b.toString('base64')}}await salida}finally{if(p.exitCode===null)p.kill()}
  yield{tipo:'fin-db',bytes,sha256:hash.digest('hex')}
  for(const bucket of buckets.data.filter(b=>b.name!=='respaldos-clinica')){yield{tipo:'bucket',nombre:bucket.name,publico:bucket.public};for await(const f of documentos(s,bucket.name)){archivos++;yield f}}
  yield{tipo:'fin',archivos}
 }
 await escribirRespaldo(destino,clave,registros());const verificado=await verificarRespaldo(destino,clave)
 console.log(JSON.stringify({respaldo:destino,verificado:true,documentos:verificado.archivos,bytesBase:verificado.bytes}))
}
async function restaurar(){
 if(!ruta||!env.RESTORE_DB_URL||!env.RESTORE_SUPABASE_URL||!env.RESTORE_SERVICE_ROLE_KEY)throw Error('Indica un respaldo y configura las tres variables RESTORE_* de un proyecto de prueba vacío.')
 if(env.RESTORE_SUPABASE_URL===env.NEXT_PUBLIC_SUPABASE_URL)throw Error('La restauración de prueba no puede usar el proyecto original.')
 const verificado=await verificarRespaldo(ruta,clave),db=conexionSQL(env.RESTORE_DB_URL,env)
 await db.connect()
 try{const r=await db.query("select count(*)::integer as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'");if(r.rows[0].n>0)throw Error('La base de destino contiene tablas públicas. Usa un proyecto de prueba vacío.');for(const tabla of ['auth.users','storage.objects']){const existe=await db.query('select to_regclass($1) as t',[tabla]);if(existe.rows[0].t){const filas=await db.query('select count(*)::integer as n from '+tabla);if(filas.rows[0].n>0)throw Error('El destino ya contiene usuarios o documentos. No se modificó.')}}}finally{await db.end()}
 const s=storage(env.RESTORE_SUPABASE_URL,env.RESTORE_SERVICE_ROLE_KEY),{p,salida}=proceso(env.PG_RESTORE_BIN??'pg_restore',['--dbname',decodeURIComponent(new URL(env.RESTORE_DB_URL).pathname.slice(1)),'--clean','--if-exists','--no-owner','--exit-on-error','--single-transaction'],env.RESTORE_DB_URL)
 p.stdout.resume()
 try{for await(const r of leerRespaldo(ruta,clave)){
  if(r.tipo==='db'){if(!p.stdin.write(Buffer.from(r.datos,'base64')))await once(p.stdin,'drain')}
  if(r.tipo==='fin-db'){p.stdin.end();await salida}
  if(r.tipo==='bucket'){const b=await s.getBucket(r.nombre);if(b.error){const creado=await s.createBucket(r.nombre,{public:r.publico});if(creado.error)throw Error('No se pudo crear un bucket de prueba.')}}
  if(r.tipo==='archivo'){const subido=await s.from(r.bucket).upload(r.ruta,Buffer.from(r.datos,'base64'),{upsert:true,contentType:/\.pdf$/i.test(r.ruta)?'application/pdf':'application/octet-stream'});if(subido.error)throw Error('No se pudo restaurar un documento. La restauración de prueba está incompleta.')}
 }await salida}finally{if(p.exitCode===null)p.kill()}
 console.log(JSON.stringify({restaurado:true,documentos:verificado.archivos,destino:'proyecto de prueba'}))
}
try{let valor=env.BACKUP_ENCRYPTION_KEY;if(!valor){try{valor=readFileSync(env.BACKUP_KEY_FILE??'.backup.key','utf8').trim()}catch{throw Error('Configura BACKUP_ENCRYPTION_KEY o ejecuta pnpm respaldo:clave.')}}clave=claveRespaldo(valor);if(accion==='crear')await crear();else if(accion==='verificar'){if(!ruta)throw Error('Indica la ruta del respaldo.');const r=await verificarRespaldo(ruta,clave);console.log(JSON.stringify({verificado:true,documentos:r.archivos,bytesBase:r.bytes}))}else if(accion==='restaurar')await restaurar();else throw Error('Acción inválida: usa crear, verificar o restaurar.')}catch(e){console.error(e.message);process.exitCode=1}
