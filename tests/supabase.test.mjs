import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { entorno } from '../scripts/entorno-operacion.mjs'

// Integración real de solo lectura. No exige nombres, horarios ni cantidades de
// una semilla antigua y no crea cuentas, citas o mensajes durante la revisión.
const env=entorno(),opciones={auth:{persistSession:false,autoRefreshToken:false}}
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,opciones)
let citas=[],medicos=[],pacientes=[],usuarios=[],agenda=[]
function comprobar(r,tabla){assert.equal(r.error,null,tabla+': '+(r.error?.code??''));return r.data}
async function todas(tabla,columnas,orden='id'){
 const filas=[]
 for(let desde=0;;desde+=500){const lote=comprobar(await db.from(tabla).select(columnas).order(orden).range(desde,desde+499),tabla);filas.push(...lote);if(lote.length<500)return filas}
}
before(async()=>{
 [citas,medicos,pacientes,usuarios,agenda]=await Promise.all([
  todas('citas','id,inicio,fin,estado,medico_id,paciente_id'),
  todas('perfiles_medicos','id,usuario_id,duracion_consulta,esta_activo'),
  todas('perfiles_pacientes','id,usuario_id,telefono_emergencia,fecha_nacimiento'),
  todas('usuarios','id,telefono,rol,esta_activo'),
  todas('configuracion_agenda','medico_id,bloques,descansos','medico_id')
 ])
})

test('la base real tiene instalada la versión compatible con las validaciones',async()=>{
 assert.equal(comprobar(await db.rpc('clinica_version'),'versión'),49)
 assert.equal(comprobar(await db.rpc('clinica_registro_habilitado'),'registro público'),true)
})

test('las citas tienen estado válido, fechas válidas y duración positiva',()=>{
 const estados=['pendiente','confirmada','atendida','cancelada_paciente','cancelada_medico','no_asistio']
 assert.equal(citas.filter(c=>!estados.includes(c.estado)||!Number.isFinite(Date.parse(c.inicio))||!(Date.parse(c.fin)>Date.parse(c.inicio))).length,0)
})

test('cada cita referencia pacientes y médicos existentes',()=>{
 const idsMedico=new Set(medicos.map(m=>m.id)),idsPaciente=new Set(pacientes.map(p=>p.id))
 assert.equal(citas.filter(c=>!idsMedico.has(c.medico_id)||!idsPaciente.has(c.paciente_id)).length,0)
})

for(const campo of ['medico_id','paciente_id'])test('no se cruzan citas reservadas o atendidas para '+campo,()=>{
 const finPorPersona=new Map()
 for(const c of citas.filter(c=>['pendiente','confirmada','atendida'].includes(c.estado)).sort((a,b)=>Date.parse(a.inicio)-Date.parse(b.inicio))){
  assert.ok((finPorPersona.get(c[campo])??-Infinity)<=Date.parse(c.inicio),'Hay un cruce de citas; revisar el calendario administrativo.')
  finPorPersona.set(c[campo],Date.parse(c.fin))
 }
})

test('las agendas publicadas respetan los días, intervalos y duraciones configuradas',()=>{
 const ids=new Set(medicos.map(m=>m.id))
 for(const m of medicos)assert.ok(Number.isInteger(m.duracion_consulta)&&m.duracion_consulta>=5&&m.duracion_consulta<=240)
 const hora=/^([01]\d|2[0-3]):[0-5]\d$/
 for(const config of agenda){
  assert.ok(ids.has(config.medico_id));assert.ok(Array.isArray(config.bloques)&&config.bloques.length<=42)
  const finPorDia=new Map()
  for(const h of [...config.bloques].sort((a,b)=>a.dia-b.dia||a.inicio.localeCompare(b.inicio))){
   assert.ok(Number.isInteger(h.dia)&&h.dia>=0&&h.dia<=6)
   assert.ok(hora.test(h.inicio)&&hora.test(h.fin)&&h.fin>h.inicio)
   if(h.paso!==undefined)assert.ok(Number.isInteger(h.paso)&&h.paso>=5&&h.paso<=240)
   assert.ok(!finPorDia.has(h.dia)||finPorDia.get(h.dia)<=h.inicio);finPorDia.set(h.dia,h.fin)
  }
  assert.ok(Array.isArray(config.descansos)&&config.descansos.length<=180)
  for(const d of config.descansos)assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)&&hora.test(d.inicio)&&hora.test(d.fin)&&d.fin>d.inicio)
 }
})

test('los roles y perfiles vinculados son coherentes y los teléfonos guardados son nacionales',()=>{
 const ids=new Set(usuarios.map(u=>u.id)),roles=['admin','medico','recepcionista','enfermero','paciente']
 assert.equal(usuarios.filter(u=>!roles.includes(u.rol)||u.telefono&&!/^[0-9]{10}$/.test(u.telefono)).length,0)
 assert.equal([...medicos,...pacientes].filter(p=>!ids.has(p.usuario_id)).length,0)
 assert.equal(pacientes.filter(p=>p.telefono_emergencia&&!/^[0-9]{10}$/.test(p.telefono_emergencia)).length,0)
})

test('las consultas relacionadas de internación resuelven las relaciones reales',async()=>{
 comprobar(await db.from('internaciones').select('id,fecha_ingreso,estado,habitaciones(numero),camas(numero,esta_ocupada),perfiles_pacientes(usuarios(nombre_completo))').limit(1),'relaciones de internación')
})

test('el acceso anónimo no obtiene filas clínicas ni avisos de pacientes',async()=>{
 const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,opciones)
 for(const tabla of ['usuarios','perfiles_pacientes','expedientes','internaciones','notificaciones']){
  const r=await anon.from(tabla).select('id').limit(1)
  if(r.error)assert.ok(['42501','PGRST301','PGRST302','PGRST303'].includes(r.error.code),tabla+': '+r.error.code)
  else assert.deepEqual(r.data,[],tabla+': no debe exponer filas sin sesión')
 }
})
