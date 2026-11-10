import { test, expect, type Page } from '@playwright/test'
import { resumirAgenda } from '../../lib/agenda/modelo'
async function preparar(page: Page, rol = 'admin', configurado = true) {
  await page.clock.setFixedTime(new Date('2026-11-09T14:00:00Z'))
  const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'prueba@example.test',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}
  const encode=(v:object)=>Buffer.from(JSON.stringify(v)).toString('base64url'),token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+7200})}.firma-prueba`
  const pacientes=[{id:7,usuario_id:70,esta_activo:true,fecha_nacimiento:null,genero:null,notas_medicas:null,usuarios:{nombre_completo:'Paciente de prueba',esta_activo:true}},{id:8,usuario_id:80,esta_activo:true,fecha_nacimiento:'1990-01-01',genero:'F',notas_medicas:JSON.stringify({tipoSangre:'A+',signosVitales:{presionArterial:'110/70',frecuenciaCardiaca:'68',fechaHora:'2026-11-08T12:00:00Z',tomadoPor:'Personal registrado'}}),usuarios:{nombre_completo:'Otra paciente',esta_activo:true}}]
  const medicos=[1,2,3].map(id=>({id,usuario_id:id+10,clinica_id:id===3?2:1,duracion_consulta:id===1?20:30,especialidad:'Medicina general',cedula_profesional:'CED-REAL-'+id,esta_activo:true,clinicas:{nombre:'Clínica de prueba'},usuarios:{nombre_completo:'Profesional '+id,esta_activo:true}}))
  const citas=[{id:101,medico_id:1,paciente_id:7,inicio:'2026-11-09T16:00:00Z',fin:'2026-11-09T16:20:00Z',estado:'pendiente',motivo:'Control de seguimiento',perfiles_pacientes:pacientes[0]},{id:102,medico_id:1,paciente_id:8,inicio:'2026-11-09T17:00:00Z',fin:'2026-11-09T17:20:00Z',estado:'confirmada',motivo:'Consulta de revisión',perfiles_pacientes:pacientes[1]}]
  let bloques=configurado?[{dia:0,inicio:'08:00',fin:'14:00'},{dia:1,inicio:'08:00',fin:'14:00'},{dia:2,inicio:'08:00',fin:'14:00'}]:[]
  let descansos=[{fecha:'2026-11-09',inicio:'09:00',fin:'09:40',motivo:'Descanso rotativo'}]
  const agendadas:any[]=[], horarios:any[]=[], expedientes:any[]=[], cambiosCita:any[]=[]
  await page.route('**/api/accesos-prueba',r=>r.fulfill({json:{habilitado:false}}))
  await page.route('**/auth/v1/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/user')?user:{access_token:token,token_type:'bearer',expires_in:7200,refresh_token:'refresh-prueba',user}}))
  await page.route('**/rest/v1/**',async r=>{
    const url=new URL(r.request().url()),tabla=url.pathname.split('/').pop();let data:any[]=[]
    if(tabla==='usuarios')data=[{id:11,auth_user_id:user.id,nombre_completo:'Profesional 1',correo:user.email,rol,esta_activo:true}]
    if(tabla==='perfiles_medicos')data=url.searchParams.has('usuario_id')?[medicos[0]]:medicos
    if(tabla==='perfiles_pacientes')data=pacientes
    if(tabla==='expedientes') {
      if(r.request().method()==='POST') {
        const body=r.request().postDataJSON(), anterior=expedientes.find(e=>e.cita_id===body.cita_id)
        if(anterior)Object.assign(anterior,body);else expedientes.push({id:expedientes.length+1,...body})
      }
      data=expedientes.filter(e=>!url.searchParams.has('cita_id')||e.cita_id===Number(url.searchParams.get('cita_id')?.replace('eq.','')))
    }
    if(tabla==='citas'&&r.request().method()==='PATCH')cambiosCita.push(r.request().postDataJSON())
    if(tabla==='citas')data=citas.filter(c=>(!url.searchParams.has('medico_id')||c.medico_id===Number(url.searchParams.get('medico_id')?.replace('eq.','')))&&(!url.searchParams.has('paciente_id')||c.paciente_id===Number(url.searchParams.get('paciente_id')?.replace('eq.',''))))
    await r.fulfill({json:data,headers:{'content-range':`0-0/${data.length}`}})
  })
  await page.route('**/api/agenda/*',async r=>{const url=new URL(r.request().url()),id=Number(url.pathname.split('/').pop());if(r.request().method()==='PATCH'){const body=r.request().postDataJSON();horarios.push({id,...body});bloques=body.bloques;descansos=body.descansos;return r.fulfill({json:{ok:true}})}return r.fulfill({json:resumirAgenda(bloques,citas.filter(c=>c.medico_id===id),url.searchParams.get('fecha')||'2026-11-09',id===1?20:30,new Date('2026-11-09T14:00:00Z'),7,descansos)})})
  await page.route('**/api/citas',r=>{agendadas.push(r.request().postDataJSON());return r.fulfill({json:{id:200+agendadas.length}})})
  await page.goto('/');await page.locator('input[type=email]').fill(user.email);await page.locator('input[type=password]').fill('Prueba123*');await page.getByRole('button',{name:'Ingresar',exact:true}).click();await expect(page.getByRole('button',{name:'Menú de usuario'})).toBeVisible()
  return {agendadas,horarios,expedientes,cambiosCita}
}
test('Mi Consulta muestra agenda e intervalos reales y no inventa datos del paciente',async({page})=>{
  const errores:string[]=[]
  page.on('pageerror',e=>errores.push(e.message))
  page.on('console',m=>{if(m.type()==='error')errores.push(m.text())})
  await preparar(page)
  await page.getByRole('button',{name:'Mi Consulta',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Disponibilidad del médico'})).toBeVisible()
  await expect(page.getByText('Control de seguimiento',{exact:true}).first()).toBeVisible()
  await expect(page.getByText('87% Hoy',{exact:true})).toHaveCount(0)
  await expect(page.getByText('22 min',{exact:true})).toHaveCount(0)
  await expect(page.getByText('Mañana 10:15 AM',{exact:true})).toHaveCount(0)
  await expect(page.getByText('Grupo sanguíneo: No registrado')).toBeVisible()
  await expect(page.getByText('Edad no registrada')).toBeVisible()
  await expect(page.getByText('No registrado',{exact:true})).toHaveCount(5)
  await expect(page.getByText(/Descanso asignado: 09:00/)).toBeVisible()
  await page.getByRole('button').filter({hasText:'Otra paciente'}).click()
  await expect(page.getByText('110/70',{exact:false})).toBeVisible()
  await expect(page.getByText('68',{exact:false}).first()).toBeVisible()
  await page.getByRole('tab',{name:'Registrar consulta'}).click()
  await expect(page.locator('textarea').first()).toHaveValue('')
  await expect(page.getByText(/Guardado automático activo/)).toHaveCount(0)
  expect(errores).toEqual([])
})
test('recepción agenda al mismo paciente con cualquiera de los tres médicos',async({page})=>{
  const {agendadas}=await preparar(page,'recepcionista')
  for(const id of [1,2,3]){
    await page.getByRole('button',{name:'Agendar cita médica',exact:true}).click();const modal=page.getByRole('dialog')
    await modal.getByLabel('Paciente',{exact:true}).fill('Paciente de prueba');await modal.getByRole('button',{name:'Paciente de prueba',exact:true}).click()
    await modal.getByLabel('Médico y especialidad',{exact:true}).selectOption(String(id));await modal.getByLabel('Fecha de la cita').fill('2026-11-10')
    const hora=id===1?'08:00':id===2?'10:00':'12:00'
    await modal.getByRole('button',{name:new RegExp(hora)}).first().click();await modal.getByLabel('Motivo de la cita').fill('Control real')
    await modal.getByRole('button',{name:'Agendar cita',exact:true}).click();await expect(modal).toHaveCount(0)
  }
  expect(agendadas).toHaveLength(3);expect(agendadas.map(c=>c.medicoId)).toEqual([1,2,3]);expect(agendadas.every(c=>c.pacienteId===7)).toBe(true)
})
test('sin horario publicado no anuncia horas libres y recepción puede proponer un intervalo',async({page})=>{
  const {agendadas}=await preparar(page,'recepcionista',false)
  await page.getByRole('button',{name:'Agendar cita médica',exact:true}).click();const modal=page.getByRole('dialog')
  await expect(modal.getByText(/aún no tiene horario publicado/)).toBeVisible()
  await modal.getByLabel('Paciente',{exact:true}).fill('Paciente de prueba');await modal.getByRole('button',{name:'Paciente de prueba',exact:true}).click()
  await modal.getByLabel('Fecha de la cita').fill('2026-11-10');await modal.getByLabel('Hora de la cita').fill('10:20');await modal.getByLabel('Motivo de la cita').fill('Revisión')
  await modal.getByRole('button',{name:'Agendar cita',exact:true}).click();await expect(modal).toHaveCount(0);expect(agendadas[0].hora).toBe('10:20')
})
test('administración asigna un descanso por fecha al médico seleccionado',async({page})=>{
  const {horarios}=await preparar(page,'admin');await page.getByRole('button',{name:'Médicos',exact:true}).click();await page.getByRole('button',{name:'Configurar horario',exact:true}).click();const modal=page.getByRole('dialog')
  await modal.getByLabel('Fecha del descanso 1').fill('2026-11-10');await modal.getByLabel('Inicio del descanso 1').fill('12:00');await modal.getByLabel('Fin del descanso 1').fill('13:00')
  await modal.getByRole('button',{name:'Guardar horario',exact:true}).click();await expect(modal).toHaveCount(0)
  expect(horarios[0].id).toBe(1);expect(horarios[0].descansos[0]).toMatchObject({fecha:'2026-11-10',inicio:'12:00',fin:'13:00'})
})
test('el error al guardar mantiene el formulario de cita para corregirlo',async({page})=>{
  await preparar(page,'recepcionista',false);await page.route('**/api/citas',r=>r.fulfill({status:409,json:{error:'El médico tiene un descanso asignado en ese intervalo.'}}))
  await page.getByRole('button',{name:'Agendar cita médica',exact:true}).click();const modal=page.getByRole('dialog');await modal.getByLabel('Paciente',{exact:true}).fill('Paciente de prueba');await modal.getByRole('button',{name:'Paciente de prueba',exact:true}).click();await modal.getByLabel('Fecha de la cita').fill('2026-11-10');await modal.getByLabel('Hora de la cita').fill('10:00');await modal.getByLabel('Motivo de la cita').fill('Control conservado');await modal.getByRole('button',{name:'Agendar cita',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('descanso asignado');await expect(modal.getByLabel('Motivo de la cita')).toHaveValue('Control conservado')
})
test('vista médica se adapta a un teléfono',async({page})=>{
  await page.setViewportSize({width:390,height:844});await preparar(page);await page.getByRole('button',{name:'Abrir menú',exact:true}).click();await page.getByRole('button',{name:'Mi Consulta',exact:true}).click();await expect(page.getByRole('heading',{name:'Disponibilidad del médico'})).toBeVisible();const ancho=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,pantalla:innerWidth}));expect(ancho.doc).toBeLessThanOrEqual(ancho.pantalla+1)
})

test('médico entra a Citas y no tiene acceso al módulo Mi Consulta',async({page})=>{
  await preparar(page,'medico')
  await expect(page.getByRole('button',{name:'Mi Consulta',exact:true})).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'Citas médicas',exact:true})).toBeVisible()
  await expect(page.getByRole('tab',{name:'Registrar consulta'})).toHaveCount(0)
})
test('recepción conserva las agendas y los descansos sin la pantalla de consulta',async({page})=>{
  await preparar(page,'recepcionista')
  await expect(page.getByRole('button',{name:'Mi Consulta',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Médicos',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Disponibilidad del médico'})).toBeVisible()
  await expect(page.getByRole('tab',{name:'Registrar consulta'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Configurar horario',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Agendar cita',exact:true})).toBeVisible()
})

test('Hoy y seleccionar el mismo médico conservan las citas del día',async({page})=>{
  await preparar(page)
  await page.getByRole('button',{name:'Mi Consulta',exact:true}).click()
  await expect(page.getByText('Control de seguimiento',{exact:true}).first()).toBeVisible()
  await page.getByRole('button',{name:'Hoy',exact:true}).click()
  await expect(page.getByText('Control de seguimiento',{exact:true}).first()).toBeVisible()
  await page.getByLabel('Seleccionar médico de la agenda').selectOption('1')
  await expect(page.getByText('Control de seguimiento',{exact:true}).first()).toBeVisible()
})

test('una falla de disponibilidad conserva las citas e impide sobrescribir horarios sin cargarlos',async({page})=>{
  await preparar(page)
  await page.route('**/api/agenda/*',r=>r.fulfill({status:503,json:{error:'No se pudo leer el horario.'}}))
  await page.getByRole('button',{name:'Mi Consulta',exact:true}).click()
  await expect(page.getByRole('alert').filter({hasText:'No se pudo leer el horario.'})).toBeVisible()
  await expect(page.getByText('Control de seguimiento',{exact:true}).first()).toBeVisible()
  await expect(page.getByRole('button',{name:'Configurar horario',exact:true})).toBeDisabled()
  await page.unroute('**/api/agenda/*')
})

test('receta exige indicaciones explícitas y permite corregir los medicamentos',async({page})=>{
  await preparar(page)
  await page.getByRole('button',{name:'Mi Consulta',exact:true}).click()
  await page.getByRole('tab',{name:'Registrar consulta'}).click()
  await page.getByLabel('Medicamento',{exact:true}).fill('Medicamento de prueba')
  await expect(page.getByLabel('Indicaciones del medicamento',{exact:true})).toHaveValue('')
  await expect(page.getByRole('button',{name:'Agregar a la receta',exact:true})).toBeDisabled()
  await page.getByLabel('Indicaciones del medicamento',{exact:true}).fill('Indicación registrada por el profesional')
  await page.getByRole('button',{name:'Agregar a la receta',exact:true}).click()
  await page.getByLabel('Indicaciones del medicamento 1',{exact:true}).fill('Indicación corregida')
  await expect(page.getByLabel('Indicaciones del medicamento 1',{exact:true})).toHaveValue('Indicación corregida')
  await expect(page.getByText('Cambios sin guardar',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Eliminar medicamento 1',exact:true}).click()
  await expect(page.getByText('Aún no hay medicamentos en esta receta.')).toBeVisible()
})

test('guardar y reabrir un borrador conserva campos y receta sin finalizar ni duplicar datos',async({page})=>{
  const {expedientes,cambiosCita}=await preparar(page)
  await page.getByRole('button',{name:'Mi Consulta',exact:true}).click()
  await page.getByRole('tab',{name:'Registrar consulta'}).click()
  await page.getByLabel('S • Subjetivo (Motivo y Anamnesis)',{exact:true}).fill('Evolución registrada por el profesional')
  await page.getByRole('button',{name:'Añadir CIE-10'}).click()
  await page.getByRole('button',{name:/\[I10\]/}).click()
  await page.getByLabel('Medicamento',{exact:true}).fill('Medicamento de prueba')
  await page.getByLabel('Indicaciones del medicamento',{exact:true}).fill('Indicación documentada')
  await page.getByRole('button',{name:'Agregar a la receta',exact:true}).click()
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click()
  await expect.poll(()=>expedientes.length).toBe(1)
  await expect(page.getByRole('button',{name:'Actualizar',exact:true})).toBeEnabled()
  const guardado={...expedientes[0]}
  await page.getByRole('button').filter({hasText:'Otra paciente'}).click()
  await page.getByRole('button').filter({hasText:'Paciente de prueba'}).click()
  await page.getByRole('tab',{name:'Registrar consulta'}).click()
  await expect(page.getByLabel('S • Subjetivo (Motivo y Anamnesis)',{exact:true})).toHaveValue('Evolución registrada por el profesional')
  await expect(page.getByLabel('Nombre del medicamento 1',{exact:true})).toHaveValue('Medicamento de prueba')
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click()
  await expect(page.getByRole('button',{name:'Actualizar',exact:true})).toBeEnabled()
  expect(expedientes).toEqual([guardado])
  expect(cambiosCita).toEqual([])
})
