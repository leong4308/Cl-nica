import { test, expect, type Page } from './fixture'
async function preparar(page: Page) {
  await page.context().grantPermissions(['local-network-access'])
  await page.clock.setFixedTime(new Date('2026-11-12T18:00:00Z'))
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'recepcion@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const token = `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, role:'authenticated' })}.prueba`
  await page.route('**/auth/v1/**', r => r.fulfill({ json: r.request().url().endsWith('/user') ? user : { user, access_token: token, refresh_token:'simulado', expires_in:3600, token_type:'bearer' } }))
  const paciente = { id:1, esta_activo:true, fecha_nacimiento:'1990-01-01', genero:'F', usuarios:{nombre_completo:'Paciente de recepción',correo:'paciente@example.test',telefono:'5551234567'} }
  await page.route('**/rest/v1/**', r => { const p=new URL(r.request().url()).pathname; return r.fulfill({json:p.endsWith('/usuarios')?[{id:4,auth_user_id:user.id,nombre_completo:'Recepción de prueba',rol:'recepcionista',esta_activo:true}]:p.endsWith('/perfiles_pacientes')?[paciente]:[]}) })
  await page.route('**/api/pacientes',r=>r.fulfill({json:{pacientes:[paciente]}}))
  const cita = {id:35,pacienteId:1,paciente:'Paciente de recepción',telefono:'5551234567',medicoId:1,medico:'Médico de prueba',inicio:'2026-11-12T21:00:00Z',fin:'2026-11-12T21:20:00Z',estado:'confirmada',motivo:'Consulta',llegada:null as string|null,enConsulta:null as string|null,version:'a'.repeat(32)}
  const datos={dia:'2026-11-12',ahora:'2026-11-12T18:00:00Z',citas:[cita],medicos:[{id:1,nombre:'Médico de prueba',especialidad:'Medicina general',bloques:[{dia:4,inicio:'08:00',fin:'20:00'}],descansos:[]}]}
  const escrituras: Record<string,unknown>[]=[]
  await page.route('**/api/recepcion**',r=>{if(r.request().method()==='POST'){const b=r.request().postDataJSON();escrituras.push(b);if(b.accion==='llegada')cita.llegada=datos.ahora;if(b.accion==='cancelar')cita.estado='cancelada_paciente';return r.fulfill({json:{ok:true,mensaje:'Acción registrada correctamente.'}})}return r.fulfill({json:datos})})
  await page.goto('/');await page.locator('input[type=email]').fill(user.email);await page.locator('input[type=password]').fill('ClaveSimulada123*');await page.getByRole('button',{name:'Ingresar',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Hola, Recepción de prueba'})).toBeVisible()
  return {datos,cita,escrituras}
}
test('registra llegada sin finalizar y muestra la sala de espera con tiempo real',async({page})=>{
 const {cita,escrituras}=await preparar(page)
 await expect(page.getByRole('button',{name:'Registrar llegada',exact:true})).toBeVisible()
 await page.screenshot({path:'.herramientas/recepcion-desktop.png',fullPage:true})
 await page.getByRole('button',{name:'Registrar llegada',exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:'Registrar llegada',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.getByText('En espera',{exact:true}).last()).toBeVisible()
 expect(cita.estado).toBe('confirmada');expect(escrituras[0]).toMatchObject({citaId:35,accion:'llegada',version:'a'.repeat(32)})
 await page.getByRole('button',{name:'Sala de espera',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Seguimiento de llegadas'})).toBeVisible()
 await expect(page.getByText(/0 min de espera/)).toBeVisible()
 await expect(page.getByRole('button',{name:'Reagendar',exact:true})).toHaveCount(0)
})
test('cancelar exige motivo y registra una acción explícita',async({page})=>{
 const {escrituras}=await preparar(page)
 await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByLabel('Motivo').fill('El paciente pidió cancelar por un compromiso personal.')
 await dialog.getByRole('button',{name:'Cancelar cita',exact:true}).click()
 await expect(dialog).toHaveCount(0)
 expect(escrituras[0]).toMatchObject({accion:'cancelar',motivo:'El paciente pidió cancelar por un compromiso personal.'})
 await expect(page.locator('article').getByText('Cancelada',{exact:true})).toBeVisible()
})
test('reagenda se bloquea a dos horas y no ofrece terminar una consulta',async({page})=>{
 const {cita}=await preparar(page);cita.inicio='2026-11-12T20:00:00Z'
 await page.getByRole('button',{name:'Actualizar',exact:true}).click()
 await expect(page.getByRole('button',{name:'Reagendar',exact:true})).toHaveCount(0)
 await expect(page.getByText('Reagenda disponible con más de 2 h de anticipación.')).toBeVisible()
 await expect(page.getByRole('button',{name:/finalizar|atendida/i})).toHaveCount(0)
})
test('directorio y ficha de recepción no exponen antecedentes, signos ni historial',async({page})=>{
 await preparar(page)
 await page.getByRole('button',{name:'Pacientes',exact:true}).click()
 await page.getByRole('textbox',{name:'Buscar paciente'}).fill('5551234567')
 await page.getByRole('button',{name:'Ver datos',exact:true}).click()
 await expect(page.getByRole('dialog')).toBeVisible()
 await expect(page.getByRole('tab',{name:'Datos del paciente'})).toBeVisible()
 await expect(page.getByRole('tab',{name:'Importante'})).toHaveCount(0)
 await expect(page.getByRole('tab',{name:'Historial clínico'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Expedientes',exact:true})).toHaveCount(0)
})
test('registro administrativo no pide notas médicas y el panel se adapta al teléfono',async({page})=>{
 await page.setViewportSize({width:390,height:844});await preparar(page)
 await page.getByRole('button',{name:'Registrar paciente',exact:true}).click()
 await expect(page.getByRole('dialog')).toBeVisible()
 await expect(page.getByLabel('Notas médicas o antecedentes')).toHaveCount(0)
 await page.screenshot({path:'.herramientas/recepcion-movil.png',fullPage:true})
 const ancho=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,pantalla:innerWidth}))
 expect(ancho.doc).toBeLessThanOrEqual(ancho.pantalla+1)
})
