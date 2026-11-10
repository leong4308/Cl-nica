import { writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { entorno } from './entorno-operacion.mjs'
const ruta=entorno().BACKUP_KEY_FILE??'.backup.key'
try{await writeFile(ruta,randomBytes(32).toString('base64')+'\n',{flag:'wx',mode:0o600});console.log('Clave creada en '+ruta+'. Guarda una copia fuera de este equipo; sin ella no podrás recuperar los respaldos. No la subas al repositorio.')}catch(e){console.error(e.code==='EEXIST'?'La clave ya existe. Se conservó sin sobrescribirla.':'No se pudo crear la clave.');process.exitCode=e.code==='EEXIST'?0:1}
