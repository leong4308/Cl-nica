import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto'
import { createReadStream,createWriteStream } from 'node:fs'
import { appendFile,open,rename,stat,unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
const MAGIC=Buffer.from('CNBACKUP1\n')
export function claveRespaldo(valor){const b=Buffer.from(valor??'','base64');if(b.length!==32||b.toString('base64')!==valor)throw Error('BACKUP_ENCRYPTION_KEY debe contener 32 bytes aleatorios codificados en base64.');return b}
export async function escribirRespaldo(ruta,clave,registros){
 const parcial=ruta+'.partial',nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',clave,nonce)
 cipher.setAAD(MAGIC)
 const archivo=createWriteStream(parcial,{flags:'wx',mode:0o600})
 await once(archivo,'open');archivo.write(Buffer.concat([MAGIC,nonce]))
 const terminar=pipeline(cipher,archivo);terminar.catch(()=>{})
 try{
  for await(const r of registros)if(!cipher.write(JSON.stringify(r)+'\n'))await once(cipher,'drain')
  cipher.end();await terminar;await appendFile(parcial,cipher.getAuthTag());await rename(parcial,ruta)
 }catch(e){cipher.destroy();archivo.destroy();await terminar.catch(()=>{});await unlink(parcial).catch(()=>{});throw e}
}
export async function* leerRespaldo(ruta,clave){
 const info=await stat(ruta),f=await open(ruta,'r'),header=Buffer.alloc(MAGIC.length+12),tag=Buffer.alloc(16)
 try{await f.read(header,0,header.length,0);await f.read(tag,0,16,info.size-16)}finally{await f.close()}
 if(info.size<header.length+16||!header.subarray(0,MAGIC.length).equals(MAGIC))throw Error('El archivo no es un respaldo de Clínica Nova.')
 const d=createDecipheriv('aes-256-gcm',clave,header.subarray(MAGIC.length));d.setAAD(MAGIC);d.setAuthTag(tag)
 const entrada=createReadStream(ruta,{start:header.length,end:info.size-17}),lineas=createInterface({input:entrada.pipe(d),crlfDelay:Infinity})
 let error
 d.on('error',e=>{error=e;lineas.close()});entrada.on('error',e=>{error=e;d.destroy(e)})
 try{for await(const linea of lineas){if(linea)yield JSON.parse(linea)}if(error)throw error}finally{entrada.destroy();d.destroy();lineas.close()}
}
export async function verificarRespaldo(ruta,clave){
 let manifiesto,finDb=false,fin=false,archivos=0,bytes=0;const hash=createHash('sha256'),rutas=new Set()
 for await(const r of leerRespaldo(ruta,clave)){
  if(fin)throw Error('El respaldo contiene datos después del cierre.')
  if(!manifiesto){if(r.tipo!=='manifiesto'||r.version!==1)throw Error('Manifiesto inválido.');manifiesto=r;continue}
  if(r.tipo==='db'){if(finDb)throw Error('Orden de datos inválido.');const b=Buffer.from(r.datos,'base64');hash.update(b);bytes+=b.length}
  else if(r.tipo==='fin-db'){if(finDb||r.bytes!==bytes||r.sha256!==hash.digest('hex'))throw Error('El respaldo de la base no está completo.');finDb=true}
  else if(r.tipo==='bucket'){if(!finDb||typeof r.nombre!=='string')throw Error('Metadatos de almacenamiento inválidos.')}
  else if(r.tipo==='archivo'){
   const ruta=r.bucket+'/'+r.ruta;if(!finDb||typeof r.ruta!=='string'||r.ruta.startsWith('/')||r.ruta.includes('\\')||r.ruta.split('/').includes('..')||rutas.has(ruta))throw Error('Ruta de respaldo inválida.')
   rutas.add(ruta);if(createHash('sha256').update(Buffer.from(r.datos,'base64')).digest('hex')!==r.sha256)throw Error('Un documento está incompleto.');archivos++
  }else if(r.tipo==='fin'){if(!finDb||r.archivos!==archivos)throw Error('Faltan documentos del respaldo.');fin=true}
  else throw Error('El respaldo contiene un registro desconocido.')
 }
 if(!fin)throw Error('El respaldo está truncado o no se pudo autenticar.')
 return{manifiesto,archivos,bytes}
}
