import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
export async function POST(request: Request) {
 if (!origenValido(request)) return NextResponse.json({error:'Origen inválido.'},{status:403})
 const a=await cuentaAutenticada();if(a.respuesta)return a.respuesta
 if(!['admin','medico'].includes(a.usuario.rol))return NextResponse.json({error:'No puedes modificar expedientes.'},{status:403})
 const b=await request.json().catch(()=>null)
 if(!b||JSON.stringify(b).length>50000)return NextResponse.json({error:'Revisa el expediente.'},{status:400})
 let citaId=Number(b.citaId)
 if(Number.isSafeInteger(Number(b.id))&&Number(b.id)>0){const n=await a.db.from('expedientes').select('cita_id').eq('id',Number(b.id)).maybeSingle();if(n.error)return errorOperacion(n.error);citaId=n.data?.cita_id}
 if(!Number.isSafeInteger(citaId)||citaId<1)return NextResponse.json({error:'Cita inválida.'},{status:400})
 const ctx=await a.db.rpc('clinica_consulta_leer',{p_cita:citaId});if(ctx.error)return errorOperacion(ctx.error)
 if(ctx.data.nota&&!b.version)return NextResponse.json({error:'Abre la consulta actual para modificar el borrador o añadir una aclaración a su nota cerrada.'},{status:409})
 const contenido=b.contenido??{subjetivo:typeof b.notas==='string'?b.notas:'',objetivo:'',diagnostico:typeof b.diagnostico==='string'?b.diagnostico:'',plan:'',recetaLibre:typeof b.receta==='string'?b.receta:'',medicamentos:[]}
 const r=await a.db.rpc('clinica_medico_operar',{p_accion:'guardar',p_datos:{citaId,version:b.version??ctx.data.version,contenido,cerrar:b.concluir===true},p_clave:b.clave??crypto.randomUUID()})
 return r.error?errorOperacion(r.error):NextResponse.json({ok:true,data:[{id:r.data.id}],mensaje:r.data.mensaje})
}
export async function DELETE(){return NextResponse.json({error:'Los expedientes se conservan. Añade una aclaración desde la consulta.'},{status:403})}
