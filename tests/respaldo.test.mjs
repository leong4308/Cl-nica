import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,rm,readFile,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes,createHash } from 'node:crypto'
import { escribirRespaldo,verificarRespaldo,leerRespaldo,claveRespaldo } from '../lib/operacion/respaldo.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')
test('respaldo cifrado recupera base y documentos y detecta alteración o clave incorrecta',async()=>{
 const carpeta=await mkdtemp(join(tmpdir(),'clinica-backup-')),ruta=join(carpeta,'prueba.cnbak'),clave=randomBytes(32),base=Buffer.from('base de prueba'),pdf=Buffer.from('%PDF-prueba')
 try{
  async function* datos(){yield{tipo:'manifiesto',version:1};yield{tipo:'db',datos:base.toString('base64')};yield{tipo:'fin-db',bytes:base.length,sha256:hash(base)};yield{tipo:'archivo',bucket:'privado',ruta:'1/resultado.pdf',datos:pdf.toString('base64'),sha256:hash(pdf)};yield{tipo:'fin',archivos:1}}
  await escribirRespaldo(ruta,clave,datos());assert.equal((await verificarRespaldo(ruta,clave)).archivos,1)
  const registros=[];for await(const r of leerRespaldo(ruta,clave))registros.push(r)
  assert.deepEqual(Buffer.from(registros[1].datos,'base64'),base);assert.deepEqual(Buffer.from(registros[3].datos,'base64'),pdf)
  const contenido=await readFile(ruta);assert.equal(contenido.includes(base),false)
  await assert.rejects(verificarRespaldo(ruta,randomBytes(32)))
  contenido[contenido.length-20]^=1;await writeFile(ruta,contenido);await assert.rejects(verificarRespaldo(ruta,clave))
 }finally{await rm(carpeta,{recursive:true,force:true})}
})
test('no acepta una clave de texto ni un respaldo sin cierre',async()=>{
 assert.throws(()=>claveRespaldo('contraseña'))
 const carpeta=await mkdtemp(join(tmpdir(),'clinica-backup-')),ruta=join(carpeta,'prueba.cnbak'),clave=randomBytes(32)
 try{async function* datos(){yield{tipo:'manifiesto',version:1}}await escribirRespaldo(ruta,clave,datos());await assert.rejects(verificarRespaldo(ruta,clave),/truncado/)}finally{await rm(carpeta,{recursive:true,force:true})}
})
