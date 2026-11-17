import {test,expect,type Page} from './fixture'
import {simularDirectorioPacientes} from './pacientes-fixture'

async function preparar(page:Page,rol='enfermero',conHilo=false){
 await simularDirectorioPacientes(page,[])
 await page.context().grantPermissions(['local-network-access'])
 const user={id:'11111111-1111-4111-8111-111111111111',email:'equipo@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}
 const enc=(v:object)=>Buffer.from(JSON.stringify(v)).toString('base64url'),token=`${enc({alg:'HS256'})}.${enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.prueba`
 await page.route('**/auth/v1/**',r=>r.fulfill({json:r.request().url().endsWith('/user')?user:{user,access_token:token,refresh_token:'simulado',expires_in:3600,token_type:'bearer'}}))
 await page.route('**/rest/v1/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/usuarios')?[{id:5,auth_user_id:user.id,nombre_completo:'Personal de prueba',rol,esta_activo:true}]:[]}))
 const personas=[{id:1,nombre:'Administración de prueba',rol:'admin'},{id:2,nombre:'Médico de prueba',rol:'medico'},{id:4,nombre:'Recepción de prueba',rol:'recepcionista'},{id:5,nombre:'Enfermero de prueba',rol:'enfermero'}],actual=personas.find(p=>p.rol===rol)!
 const hilo='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ahora=new Date().toISOString()
 const datos:any={usuarioId:actual.id,destinatarios:personas.filter(p=>p.id!==actual.id),pacientes:[],conversaciones:conHilo?[{id:hilo,iniciador_id:5,destinatario_id:actual.id,iniciador:'Enfermero de prueba',destinatario:actual.nombre,ambito:'administrativo',asunto:'Coordinar atención del turno',paciente:null,urgente:false,actualizado_en:ahora,sin_leer:1,mensajes:[{id:hilo,autor:5,responsable:'Enfermero de prueba',contenido:'Solicito coordinar la llegada al turno.',creado_en:ahora}]}]:[]}
 let fallar=false;const escrituras:any[]=[]
 await page.route('**/api/equipo',async r=>{
  if(r.request().method()==='GET')return r.fulfill({json:datos})
  const b=r.request().postDataJSON();escrituras.push(b)
  if(fallar&&b.accion==='enviar'){fallar=false;return r.fulfill({status:503,json:{error:'Conexión temporal. Puedes reintentar.'}})}
  if(b.accion==='enviar'){
   const d=personas.find(p=>p.id===b.datos.destinatario)!
   datos.conversaciones.unshift({id:b.clave,iniciador_id:actual.id,destinatario_id:d.id,iniciador:actual.nombre,destinatario:d.nombre,ambito:b.datos.ambito,asunto:b.datos.asunto,paciente:null,urgente:b.datos.urgente,actualizado_en:ahora,sin_leer:0,mensajes:[{id:b.clave,autor:actual.id,responsable:actual.nombre,contenido:b.datos.contenido,creado_en:ahora}]})
   return r.fulfill({json:{ok:true,id:b.clave}})
  }
  const c=datos.conversaciones.find((c:any)=>c.id===b.datos.id)
  if(b.accion==='leer')c.sin_leer=0
  if(b.accion==='responder')c.mensajes.push({id:b.clave,autor:actual.id,responsable:actual.nombre,contenido:b.datos.contenido,creado_en:ahora})
  return r.fulfill({json:{ok:true,id:b.datos.id}})
 })
 const datosEnfermeria={rol,usuarioId:actual.id,enfermeroId:1,servidorAhora:ahora,pacientes:[],enfermeros:[],turnos:[],tareas:[],registros:[],citas:[],ingresos:[],ordenes:[],muestras:[],movimientos:[],camas:[],resumenCamas:{total:6,ocupadas:2,libres:4},mapaCamas:Array.from({length:6},(_,i)=>({id:i+1,numero:String(i+1),habitacion:'101',tipo:'General',clinica_id:1,esta_ocupada:i<2,habilitada:true,habitacion_activa:true}))}
 await page.route('**/api/enfermeria',r=>r.fulfill({json:datosEnfermeria}))
 await page.goto('/');await page.locator('input[type=email]').fill(user.email);await page.locator('input[type=password]').fill('ClaveSimulada123*');await page.getByRole('button',{name:'Ingresar',exact:true}).click();await expect(page.getByRole('button',{name:'Menú de usuario'})).toBeVisible()
 return{datos,datosEnfermeria,escrituras,fallar:()=>fallar=true}
}

test('el botón azul registra una admisión real y conserva el formulario ante un conflicto de cama',async({page})=>{
 const escrituras:any[]=[],consultas:string[]=[];let fallo=true
 await page.route('**/api/enfermeria/ingresos**',r=>{
  if(r.request().method()==='POST'){
   escrituras.push(r.request().postDataJSON())
   if(fallo){fallo=false;return r.fulfill({status:409,json:{error:'La cama ya está ocupada. Revisa las opciones.'}})}
   return r.fulfill({json:{ok:true,id:99}})
  }
  const q=new URL(r.request().url()).searchParams.get('buscar')??'';consultas.push(q)
  return r.fulfill({json:{ingresos:[],pacientes:[{id:7,nombre:'Paciente de admisión · PAC-00007',ingresoActivo:false}],medicos:[{id:2,nombre:'Médico responsable',especialidad:'General',clinicaId:1}],camas:[{id:3,habitacionId:1,clinicaId:1,numero:'A',habitacion:'101',tipo:'General',ocupada:!fallo,habilitada:true},{id:4,habitacionId:1,clinicaId:1,numero:'B',habitacion:'101',tipo:'General',ocupada:false,habilitada:true}]}})
 })
 await page.setViewportSize({width:390,height:844})
 await preparar(page)
 await page.getByRole('button',{name:'Registrar ingreso urgente',exact:true}).click()
 const modal=page.getByRole('dialog',{name:'Registrar ingreso urgente',exact:true})
 await expect(page.getByRole('dialog',{name:'Nuevo mensaje al equipo',exact:true})).toHaveCount(0)
 await expect(modal.getByRole('searchbox',{name:'Buscar paciente registrado',exact:true})).toHaveCount(0)
 await modal.getByRole('combobox',{name:'Paciente a internar',exact:true}).selectOption('7')
 await modal.getByRole('combobox',{name:'Médico responsable',exact:true}).selectOption('2')
 await modal.getByRole('radio',{name:/Cama A/}).check()
 await modal.getByRole('textbox',{name:/Motivo del internamiento/}).fill('Requiere observación')
 await modal.getByRole('textbox',{name:'Observaciones de enfermería (opcional)',exact:true}).fill('Se recibe para valoración')
 const guardar=modal.getByRole('button',{name:'Registrar ingreso',exact:true})
 await expect(guardar).toBeInViewport();expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 await expect(guardar).toBeDisabled();await modal.getByRole('checkbox').check();await guardar.click()
 await expect(modal.getByRole('alert')).toContainText('La cama ya está ocupada')
 await expect(modal.getByRole('textbox',{name:/Motivo del internamiento/})).toHaveValue('Requiere observación')
 await modal.getByRole('radio',{name:/Cama B/}).check();await modal.getByRole('checkbox').check();await guardar.click()
 await expect(modal).toHaveCount(0);await expect(page.getByText(/Ingreso urgente #99 registrado/)).toBeVisible()
 expect(escrituras).toHaveLength(2);expect(escrituras[1].datos).toEqual({pacienteId:7,medicoId:2,camaId:4,motivo:'Requiere observación',observaciones:'Se recibe para valoración',confirmado:true})
 expect(consultas).toContain('')
})

test('Internación distingue estados, muestra al ocupante y abre una admisión desde una cama libre',async({page})=>{
 const e=await preparar(page)
 Object.assign(e.datosEnfermeria.mapaCamas[0],{numero:'Cama 101-A',habitacion:'Habitación 101',ocupante:{id:33,pacienteId:7,paciente:'Paciente hospitalizado de prueba',medicoId:2,medico:'Médico responsable de prueba',fechaIngreso:'2026-11-17T14:00:00Z',asignado:false}})
 e.datosEnfermeria.mapaCamas[5].habilitada=false
 await page.route('**/api/enfermeria/ingresos**',r=>r.fulfill({json:{ingresos:[],pacientes:[{id:8,nombre:'Paciente para ingresar',ingresoActivo:false}],medicos:[{id:2,nombre:'Médico',especialidad:'General',clinicaId:1}],camas:[{id:3,habitacionId:1,clinicaId:1,numero:'3',habitacion:'101',tipo:'General',ocupada:false,habilitada:true}]}}))
 await page.getByRole('complementary').getByRole('button',{name:'Internación',exact:true}).click()
 await page.getByRole('button',{name:'Actualizar',exact:true}).click()
 await expect(page.getByText('Paciente hospitalizado de prueba',{exact:true})).toBeVisible()
 await page.screenshot({path:'.herramientas/enfermeria-censo-048.png',fullPage:true})
 const filtros=page.getByRole('group',{name:'Filtrar camas'})
 await filtros.getByRole('button',{name:'Ocupadas (2)',exact:true}).click()
 await expect(page.getByRole('button',{name:/^Ver cama /})).toHaveCount(2)
 await page.getByRole('button',{name:'Ver cama 101-A, habitación 101',exact:true}).click()
 const detalle=page.getByRole('dialog',{name:'Habitación 101 · Cama 101-A',exact:true})
 await expect(detalle.getByText('Médico responsable de prueba',{exact:true})).toBeVisible()
 await expect(detalle.getByRole('button',{name:'Ver cuidados del paciente',exact:true})).toHaveCount(0)
 await expect(detalle.getByText(/Administración debe asignarte el turno/)).toBeVisible()
 await detalle.getByRole('button',{name:'Cerrar',exact:true}).last().click()
 await filtros.getByRole('button',{name:'Fuera de servicio (1)',exact:true}).click()
 await expect(page.getByRole('button',{name:/^Ver cama /})).toHaveCount(1)
 await filtros.getByRole('button',{name:'Disponibles (3)',exact:true}).click()
 await page.getByRole('button',{name:'Ver cama 3, habitación 101',exact:true}).click()
 await page.getByRole('button',{name:'Ingresar paciente en esta cama',exact:true}).click()
 const ingreso=page.getByRole('dialog',{name:'Registrar ingreso urgente',exact:true})
 await expect(ingreso.getByRole('radio',{name:/Cama 3/})).toBeChecked()
 await expect(ingreso.getByRole('combobox',{name:'Paciente a internar'}).getByRole('option',{name:'Paciente para ingresar',exact:true})).toHaveCount(1)
 await expect(ingreso.getByRole('searchbox',{name:'Buscar paciente registrado'})).toHaveCount(0)
})

test('enfermería usa el resumen de Gabriel y contacta a recepción, conservando un reintento',async({page})=>{
 const e=await preparar(page);e.fallar()
 await expect(page.getByRole('heading',{name:'Hola, Personal de prueba',exact:true})).toBeVisible()
 await expect(page.getByText('2 / 6',{exact:true})).toBeVisible();await expect(page.getByText('4 camas disponibles en tu clínica',{exact:true})).toBeVisible()
 await page.screenshot({path:'.herramientas/enfermeria-resumen.png',fullPage:true})
 await page.getByRole('button',{name:'Contactar recepción',exact:true}).click()
 const modal=page.getByRole('dialog',{name:'Nuevo mensaje al equipo',exact:true})
 await expect(modal.getByRole('combobox',{name:'Destinatario',exact:true})).toHaveValue('4')
 await expect(modal.getByRole('combobox',{name:'Tipo de comunicación',exact:true})).toBeDisabled()
 await modal.getByRole('textbox',{name:'Mensaje',exact:true}).fill('Favor de coordinar el ingreso y avisar al médico.')
 await modal.getByRole('button',{name:'Enviar mensaje',exact:true}).click()
 await expect(modal.getByRole('alert')).toContainText('Conexión temporal')
 await expect(modal.getByRole('textbox',{name:'Mensaje',exact:true})).toHaveValue('Favor de coordinar el ingreso y avisar al médico.')
 await modal.getByRole('button',{name:'Enviar mensaje',exact:true}).click();await expect(modal).toHaveCount(0)
 expect(e.escrituras.filter(b=>b.accion==='enviar')).toHaveLength(2)
 expect(e.escrituras[0].clave).toBe(e.escrituras[1].clave)
 expect(e.escrituras[1].datos).toMatchObject({destinatario:4,ambito:'administrativo',pacienteId:null,urgente:false})
 expect(e.escrituras[1].datos).not.toHaveProperty('autor')
 await expect(page.getByRole('heading',{name:'Coordinación del turno',exact:true})).toBeVisible()
 await page.screenshot({path:'.herramientas/equipo-enfermeria.png',fullPage:true})
})

for(const rol of ['medico','recepcionista'])test(`${rol}: recibe un mensaje del enfermero, lo lee y responde desde su bandeja`,async({page})=>{
 const e=await preparar(page,rol,true)
 await page.getByRole('complementary').getByRole('button',{name:'Equipo',exact:true}).click()
 await page.getByRole('complementary',{name:'Conversaciones del equipo'}).getByRole('button',{name:/Enfermero de prueba/}).click()
 await expect(page.getByRole('list',{name:'Mensajes de la conversación'})).toContainText('Solicito coordinar la llegada al turno.')
 await page.getByRole('textbox',{name:'Tu respuesta',exact:true}).fill('Recibido. Coordinaré la atención solicitada.')
 await page.getByRole('button',{name:'Enviar respuesta',exact:true}).click()
 await expect(page.getByRole('list',{name:'Mensajes de la conversación'})).toContainText('Recibido. Coordinaré la atención solicitada.')
 expect(e.escrituras.map(b=>b.accion)).toEqual(['leer','responder'])
})

test('el resumen y la comunicación de enfermería funcionan en móvil sin desbordamiento',async({page})=>{
 await page.setViewportSize({width:390,height:844});await preparar(page)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'Contactar recepción',exact:true}).click()
 const modal=page.getByRole('dialog',{name:'Nuevo mensaje al equipo',exact:true})
 await expect(modal.getByRole('button',{name:'Enviar mensaje',exact:true})).toBeInViewport()
 expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 await page.screenshot({path:'.herramientas/equipo-movil.png',fullPage:true})
})
