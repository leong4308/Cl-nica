import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
async function estado(accion: string) {
  const a=await cuentaAutenticada(false);if(a.respuesta)return a.respuesta
  const r=await a.db.rpc('clinica_estado_sesion',{p_accion:accion});if(r.error)return errorOperacion(r.error)
  return NextResponse.json({...r.data,usuarioId:a.user.id,correo:a.user.email,nombre:a.usuario.nombre_completo},{headers:{'Cache-Control':'private, no-store'}})
}
export async function GET(){return estado('estado')}
export async function POST(request: Request){
  if(!origenValido(request))return NextResponse.json({error:'Origen inválido.'},{status:403})
  const b=await request.json().catch(()=>null)
  if(!b||!['actividad','bloquear'].includes(b.accion))return NextResponse.json({error:'Acción inválida.'},{status:400})
  return estado(b.accion)
}
