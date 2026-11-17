import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function cargar(ruta, deps = {}) {
  const js = ts.transpileModule(readFileSync(new URL(ruta, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require', 'exports', js)((id) => id === '@/lib/pacientes/acceso' ? { autorizarRegistro: async () => null } : id === '@/lib/supabase/error-operacion' ? cargar('../lib/supabase/error-operacion.ts') : deps[id] ?? (id === '@/lib/cuenta/validacion' ? cargar('../lib/cuenta/validacion.ts') : require(id)), exports)
  return exports
}
const listado = cargar('../lib/pacientes/listado.ts')

test('registrar un paciente valida sus contactos, identidad y nacimiento antes de la transacción',async()=>{
 const llamadas=[],query={select(){return query},eq(){return query},maybeSingle:async()=>({data:{rol:'recepcionista',esta_activo:true}})}
 const db={auth:{getUser:async()=>({data:{user:{id:'recepcion'}}})},from:()=>query,rpc:async(...args)=>{llamadas.push(args);return{data:{ok:true}}}}
 const api=cargar('../app/api/pacientes/route.ts',{'@/lib/cuenta/servidor':{origenValido:()=>true},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/pacientes/listado':listado})
 const enviar=body=>api.POST(new Request('http://localhost/api/pacientes',{method:'POST',body:JSON.stringify(body)}))
 const base={nombre:'María-José López',telefono:'0123456789',fechaNacimiento:'1990-05-14',genero:'F',correo:'paciente@example.test'}
 for(const cambio of [{telefono:'123'},{telefono:'12345678901'},{telefono:'961-123-4567'},{nombre:'Paciente123'},{fechaNacimiento:'1899-01-01'},{fechaNacimiento:'2100-01-01'},{correo:'no-correo'},{contactoEmergencia:'Contacto solo'},{genero:'X'},{notasMedicas:'a'.repeat(8001)}])assert.equal((await enviar({...base,...cambio})).status,400)
 assert.equal(llamadas.length,0);assert.equal((await enviar(base)).status,200);assert.equal(llamadas.length,1)
})
function escenario({ sinPerfil = false, fallo = false } = {}) {
  const tablas = {
    paciente_medicos: [],
    perfiles_medicos: sinPerfil ? [] : [{ id: 1, usuario_id: 10, esta_activo: true }, { id: 2, usuario_id: 20, esta_activo: true }],
    perfiles_pacientes: [7,8,9,10,11].map(id => ({ id, usuarios: { nombre_completo: `Paciente ${id}` } })),
    citas: [
      { id: 1, medico_id: 1, paciente_id: 7, estado: 'atendida' },
      { id: 2, medico_id: 2, paciente_id: 8, estado: 'confirmada' },
      { id: 3, medico_id: 1, paciente_id: 9, estado: 'cancelada_paciente' },
      { id: 4, medico_id: 1, paciente_id: 7, estado: 'pendiente' },
      { id: 5, medico_id: 2, paciente_id: 7, estado: 'atendida' },
      { id: 6, medico_id: 1, paciente_id: 11, estado: 'no_asistio' },
    ],
    internaciones: [{ id: 1, medico_responsable_id: 1, paciente_id: 10 }],
  }
  const db = { from(tabla) {
    let filtros = [], rango = [0, Infinity]
    const q = {
      select() { return q }, eq(k,v) { filtros.push(f => f[k] === v); return q }, in(k,vs) { filtros.push(f => vs.includes(f[k])); return q }, order() { return q }, range(a,b) { rango=[a,b]; return q },
      async maybeSingle() { return { data: tablas[tabla].find(f => filtros.every(fn => fn(f))) ?? null, error: null } },
      then(ok,err) { return Promise.resolve({ data: tablas[tabla].filter(f => filtros.every(fn => fn(f))).slice(rango[0],rango[1]+1), error: fallo && tabla === 'citas' ? { message: 'fallo' } : null }).then(ok,err) },
    }; return q
  } }
  return db
}
test('cada médico ve sus citas y sus internaciones, sin pacientes de otro médico ni duplicados', async () => {
  const db = escenario()
  assert.deepEqual((await listado.listarPacientes(db,{id:10,rol:'medico'})).map(p=>p.id),[7,10])
  assert.deepEqual((await listado.listarPacientes(db,{id:20,rol:'medico'})).map(p=>p.id),[7,8])
})
test('una cita cancelada o una inasistencia sin atención previa no asigna al paciente', async () => {
  const filas = await listado.listarPacientes(escenario(), {id:10,rol:'medico'})
  assert.ok(!filas.some(p=>[9,11].includes(p.id)))
})
test('administración y enfermería conservan el directorio permitido por sus políticas', async () => {
  for (const rol of ['admin','enfermero']) assert.equal((await listado.listarPacientes(escenario(),{id:10,rol})).length,5)
})
test('médico sin perfil o con fallo no recibe como alternativa la lista completa', async () => {
  assert.deepEqual(await listado.listarPacientes(escenario({sinPerfil:true}),{id:10,rol:'medico'}),[])
  await assert.rejects(listado.listarPacientes(escenario({fallo:true}),{id:10,rol:'medico'}),/relación/)
})
test('API usa el usuario autenticado, ignora IDs externos y rechaza roles ajenos', async () => {
  let recibido
  const cuenta = { cuentaAutenticada: async () => ({ db: escenario(), usuario: {id:10,rol:'medico'} }) }
  const api = cargar('../app/api/pacientes/route.ts', {
    '@/lib/supabase/server': {}, '@/lib/cuenta/servidor': cuenta,
    '@/lib/pacientes/listado': { listarPacientes: async(db, usuario) => { recibido=usuario; return listado.listarPacientes(db,usuario) } },
  })
  const respuesta = await api.GET(new Request('http://localhost/api/pacientes?medicoId=2'))
  assert.equal(respuesta.status,200)
  assert.deepEqual(recibido,{id:10,rol:'medico'})
  assert.deepEqual((await respuesta.json()).pacientes.map(p=>p.id),[7,10])
  cuenta.cuentaAutenticada=async()=>({db:escenario(),usuario:{id:10,rol:'paciente'}})
  assert.equal((await api.GET()).status,403)
  cuenta.cuentaAutenticada=async()=>({respuesta:Response.json({error:'Sin sesión'},{status:401})})
  assert.equal((await api.GET()).status,401)
})
