import { createClient } from '@supabase/supabase-js'
import { entorno } from './entorno-operacion.mjs'
const env=entorno(),db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const medicos=await db.from('perfiles_medicos').select('id')
if(medicos.error)throw Error('No se pudieron consultar los médicos.')
for(const {id}of medicos.data){
 const previa=await db.from('configuracion_agenda').select('medico_id').eq('medico_id',id).maybeSingle()
 if(previa.error)throw Error('Primero aplica las migraciones 018 y 019.')
 if(previa.data)continue
 const archivo=await db.storage.from('agenda-medica').download(`${id}/horario.json`)
 if(archivo.error){if(['400','404'].includes(String(archivo.error.statusCode)))continue;throw Error('No se pudo leer una agenda privada.')}
 const config=JSON.parse(await archivo.data.text())
 if(!Array.isArray(config.bloques)||!Array.isArray(config.descansos??[]))throw Error('Una agenda contiene datos inválidos; no se importó.')
 const r=await db.from('configuracion_agenda').insert({medico_id:id,bloques:config.bloques,descansos:config.descansos??[]})
 if(r.error)throw Error('No se pudo importar una agenda. No se sobrescribieron agendas publicadas.')
 console.log('Agenda importada: médico '+id)
}
