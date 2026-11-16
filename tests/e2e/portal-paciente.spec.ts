import { test, expect, type Page } from './fixture'

async function preparar(page: Page, vacio = false, cercana = false) {
  await page.context().grantPermissions(['local-network-access'])
  await page.clock.setFixedTime(new Date('2026-11-10T16:00:00Z'))
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'mariana@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const token = `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })}.prueba`
  const tablas: string[] = []
  await page.route('**/auth/v1/**', r => r.fulfill({ json: r.request().url().endsWith('/user') ? user : { user, access_token: token, refresh_token: 'simulado', expires_in: 3600, token_type: 'bearer' } }))
  await page.route('**/rest/v1/**', r => { const tabla = new URL(r.request().url()).pathname.split('/').pop()!; tablas.push(tabla); return r.fulfill({ json: tabla === 'usuarios' ? [{ id: 201, auth_user_id: user.id, nombre_completo: 'Mariana Torres', rol: 'paciente', esta_activo: true }] : [] }) })
  const datos = {
    perfil: { id: 1, nombre: 'Mariana Torres', correo: user.email, telefono: '9611234567', fecha_nacimiento: '1996-04-03', genero: 'F', contacto_emergencia: 'Contacto propio', telefono_emergencia: '9617654321' },
    citas: vacio ? [] : [{ id: 35, version: 'a'.repeat(32), inicio: cercana ? '2026-11-10T18:00:00Z' : '2026-11-11T17:00:00Z', fin: cercana ? '2026-11-10T18:20:00Z' : '2026-11-11T17:20:00Z', estado: 'pendiente', medico: 'Dra. Ana López', especialidad: 'Medicina general', clinica: 'Clínica Nova', direccion: 'Sede central', telefono_clinica: '9611234567', motivo: 'Control de seguimiento' }],
    consultas: vacio ? [] : [{ id: 1, fecha: '2026-10-01T16:00:00Z', medico: 'Dra. Ana López', motivo: 'Consulta personal', diagnostico: 'Diagnóstico propio', receta: 'Receta propia' }],
    resultados: vacio ? [] : [{ id: 4, estudio: 'Estudio terminado', fecha: '2026-11-01T16:00:00Z', estado: 'completado', resultado: 'Resultado propio', con_documento: true }, { id: 5, estudio: 'Estudio pendiente', fecha: '2026-11-10T16:00:00Z', estado: 'solicitado', resultado: null, con_documento: false }],
  }
  await page.route('**/api/portal-paciente', r => r.fulfill({ json: datos }))
  await page.route('**/api/portal-paciente/documentos/expedientes/1', r => r.fulfill({ json: { archivos: [{ nombre: 'Documento propio.pdf', href: '/api/portal-paciente/documentos/expedientes/1?archivo=propio.pdf' }] } }))
  await page.goto('/')
  await page.locator('input[type=email]').fill(user.email)
  await page.locator('input[type=password]').fill('ClaveSimulada123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu salud, en un solo lugar' })).toBeVisible()
  return { tablas, datos }
}

test('el paciente desactiva sus recordatorios de correo desde Notificaciones', async ({ page }) => {
  const cambios: any[] = []
  await page.route('**/api/notificaciones/correo', r => {
    if (r.request().method() === 'PATCH') { const b = r.request().postDataJSON(); cambios.push(b); return r.fulfill({ json: { activo: b.activo } }) }
    return r.fulfill({ json: { paciente: true, correo: 'mariana@example.test', verificado: true, configurado: true, activo: true } })
  })
  await preparar(page)
  await page.getByRole('button', { name: /Notificaciones/ }).first().click()
  const opcion = page.getByRole('checkbox', { name: 'Recibir avisos y recordatorios de mis citas' })
  await expect(opcion).toBeChecked(); await opcion.uncheck(); await expect(opcion).not.toBeChecked()
  expect(cambios).toEqual([{ activo: false }])
})

test('reserva desde su sesión, revisa el turno y confirma sin volver a capturar sus datos', async ({ page }) => {
  const { datos } = await preparar(page, true)
  const escrituras: Record<string, unknown>[] = []
  await page.route('**/api/citas/reservar**', async r => {
    if (r.request().method() === 'POST') {
      escrituras.push(r.request().postDataJSON())
      return r.fulfill({ json: { id: 55, mensaje: 'Tu cita quedó agendada y confirmada.' } })
    }
    return r.fulfill({ json: new URL(r.request().url()).searchParams.has('medico') ? { configurado: true, turnos: [{ inicio: '2026-11-12T16:00:00Z', fin: '2026-11-12T16:20:00Z' }] } : { paciente: datos.perfil, medicos: [{ id: 1, nombre: 'Dra. Ana López', especialidad: 'Medicina general', clinica: 'Clínica Nova', publicado: true }] } })
  })
  await page.getByRole('button', { name: 'Agendar mi cita', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Agendar mi cita' })
  await expect(modal.getByText('Mariana Torres', { exact: true })).toBeVisible()
  await modal.getByLabel('Médico', { exact: true }).selectOption('1')
  await modal.getByRole('button', { name: '10:00 – 10:20' }).click()
  expect(escrituras).toHaveLength(0)
  await modal.getByLabel(/Motivo de consulta/).fill('Control de seguimiento')
  await modal.getByRole('button', { name: 'Confirmar y agendar' }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras).toHaveLength(1)
  expect(escrituras[0]).toMatchObject({ medico: 1, inicio: '2026-11-12T16:00:00Z', motivo: 'Control de seguimiento' })
  expect(escrituras[0]).not.toHaveProperty('paciente')
  await expect(page.getByRole('status').filter({ hasText: 'Tu cita quedó agendada' })).toBeVisible()
})

test('el paciente entra a su portal, ve su próxima cita y nunca precarga el resumen administrativo', async ({ page }) => {
  const { tablas } = await preparar(page)
  await expect(page.getByText('11 de noviembre de 2026', { exact: true })).toBeVisible()
  await expect(page.getByText('Dra. Ana López', { exact: true })).toBeVisible()
  for (const texto of ['Resumen de Clínica Nova', 'Pacientes activos', 'Camas ocupadas', 'Órdenes pendientes', 'Médicos en turno']) await expect(page.getByText(texto, { exact: true })).toHaveCount(0)
  for (const nombre of ['Buscar paciente', 'Registrar paciente', 'Nueva cita', 'Usuarios']) await expect(page.getByRole('button', { name: nombre, exact: true })).toHaveCount(0)
  expect(tablas.filter(t => t !== 'usuarios')).toEqual([])
  await page.getByRole('button', { name: 'Ver detalles de mi cita', exact: true }).click()
  const cita = page.getByRole('dialog', { name: 'Mi cita', exact: true })
  await expect(cita.getByText('Cita #35', { exact: false })).toBeVisible()
  await expect(cita.getByText('Pendiente de confirmación', { exact: true })).toBeVisible()
  await expect(cita.getByRole('button', { name: /Editar|Eliminar/ })).toHaveCount(0)
})

test('el paciente consulta sus resultados y documentos sin opciones de editar o subir', async ({ page }) => {
  await preparar(page)
  await page.getByRole('button', { name: 'Mis resultados', exact: true }).click()
  await expect(page.getByText('En preparación', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Consultar resultado', exact: true }).click()
  const resultado = page.getByRole('dialog', { name: 'Estudio terminado', exact: true })
  await expect(resultado.getByText('Resultado propio', { exact: true })).toBeVisible()
  await expect(resultado.getByRole('link', { name: 'Abrir mi resultado PDF' })).toHaveAttribute('href', '/api/portal-paciente/documentos/laboratorio/4')
  await resultado.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Mis consultas', exact: true }).click()
  await page.getByRole('button', { name: 'Ver consulta y documentos', exact: true }).click()
  const consulta = page.getByRole('dialog', { name: 'Mi consulta', exact: true })
  await expect(consulta.getByText('Diagnóstico propio', { exact: true })).toBeVisible()
  await expect(consulta.getByRole('link', { name: 'Documento propio.pdf' })).toBeVisible()
  await expect(consulta.locator('input[type=file],textarea')).toHaveCount(0)
})

test('el portal vacío se adapta al teléfono y conserva navegación propia', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await preparar(page, true)
  await expect(page.getByRole('heading', { name: 'Tu agenda está libre' })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click()
  await page.getByRole('button', { name: 'Mis citas', exact: true }).click()
  await expect(page.getByText('No tienes citas registradas.', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('el paciente confirma asistencia y elige un turno libre para reagendar al tocarlo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { datos } = await preparar(page)
  const respuestas: Record<string, unknown>[] = [], elegidos: Record<string, unknown>[] = []
  await page.route('**/api/citas/respuestas', async r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { solicitudes: [] } })
    respuestas.push(r.request().postDataJSON()); datos.citas[0].estado='confirmada'
    return r.fulfill({ json: { mensaje: 'Tu asistencia quedó confirmada.' } })
  })
  await page.route('**/api/citas/turnos**',async r=>{
    if(r.request().method()==='GET')return r.fulfill({json:{permitido:true,configurado:true,turnos:[{inicio:'2026-11-12T14:00:00Z',fin:'2026-11-12T14:20:00Z'}]}})
    elegidos.push(r.request().postDataJSON());Object.assign(datos.citas[0],{inicio:'2026-11-12T14:00:00Z',fin:'2026-11-12T14:20:00Z',estado:'confirmada',version:'b'.repeat(32)})
    return r.fulfill({json:{mensaje:'Tu cita se reagendó y tu asistencia quedó confirmada. Se avisó al médico y a recepción.'}})
  })
  await page.getByRole('button',{name:'Ver detalles de mi cita',exact:true}).click()
  const modal=page.getByRole('dialog',{name:'Mi cita',exact:true})
  await modal.getByRole('button',{name:'Sí asistiré',exact:true}).click()
  await expect(modal.getByText('Tu asistencia quedó confirmada.',{exact:true})).toBeVisible()
  await modal.getByRole('button',{name:'Ver horarios libres',exact:true}).click()
  await expect(modal.getByRole('button',{name:'jueves, 12 de noviembre',exact:true})).toBeVisible()
  expect(await modal.locator(':scope > div').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  await modal.getByRole('button',{name:'08:00 – 08:20',exact:true}).click()
  await expect(modal.getByText('Tu cita se reagendó y tu asistencia quedó confirmada. Se avisó al médico y a recepción.',{exact:true})).toBeVisible()
  await expect(modal.getByRole('heading',{name:'12 de noviembre de 2026',exact:true})).toBeVisible()
  expect(respuestas.map(r=>r.accion)).toEqual(['confirmar'])
  expect(elegidos).toEqual([{citaId:35,version:'a'.repeat(32),inicio:'2026-11-12T14:00:00Z'}])
})

test('cuando faltan dos horas se bloquea reagendar y se mantienen confirmar y cancelar',async({page})=>{
  await preparar(page,false,true)
  await page.getByRole('button',{name:'Ver detalles de mi cita',exact:true}).click()
  const modal=page.getByRole('dialog',{name:'Mi cita',exact:true})
  await expect(modal.getByRole('button',{name:'Ver horarios libres',exact:true})).toBeDisabled()
  await expect(modal.getByRole('button',{name:'Sí asistiré',exact:true})).toBeEnabled()
  await expect(modal.getByRole('button',{name:'Cancelar mi cita',exact:true})).toBeEnabled()
  await expect(modal.getByText('Faltan dos horas o menos. Puedes confirmar asistencia o cancelar; ya no es posible reagendar.',{exact:true})).toBeVisible()
})

test('un turno ocupado mientras se elige conserva la cita y muestra la agenda actualizada',async({page})=>{
  await preparar(page)
  let ocupado=false
  await page.route('**/api/citas/turnos**',async r=>{
    if(r.request().method()==='GET')return r.fulfill({json:{permitido:true,configurado:true,turnos:ocupado?[]:[{inicio:'2026-11-12T14:00:00Z',fin:'2026-11-12T14:20:00Z'}],motivo:ocupado?'No hay turnos libres en esta semana.':null}})
    ocupado=true;return r.fulfill({status:409,json:{error:'Este horario ya no está disponible. Actualiza la agenda y elige otro'}})
  })
  await page.getByRole('button',{name:'Ver detalles de mi cita',exact:true}).click()
  const modal=page.getByRole('dialog',{name:'Mi cita',exact:true})
  await modal.getByRole('button',{name:'Ver horarios libres',exact:true}).click()
  await modal.getByRole('button',{name:'08:00 – 08:20',exact:true}).click()
  await expect(modal.getByText('Este horario ya no está disponible. Actualiza la agenda y elige otro',{exact:true})).toBeVisible()
  await expect(modal.getByRole('heading',{name:'11 de noviembre de 2026',exact:true})).toBeVisible()
  await expect(modal.getByRole('button',{name:'08:00 – 08:20',exact:true})).toHaveCount(0)
})

test('cancelar exige confirmar y un conflicto de versión muestra el aviso del servidor', async ({ page }) => {
  const { datos } = await preparar(page), respuestas: Record<string, unknown>[] = []
  await page.route('**/api/citas/respuestas', async r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { solicitudes: [] } })
    const b = r.request().postDataJSON(); respuestas.push(b)
    if (b.accion === 'confirmar') return r.fulfill({ status: 409, json: { error: 'La cita cambió. Actualiza sus detalles antes de responder' } })
    datos.citas[0].estado = 'cancelada_paciente'
    return r.fulfill({ json: { mensaje: 'Tu cita quedó cancelada. Se notificó a recepción y al médico.' } })
  })
  await page.getByRole('button', { name: 'Ver detalles de mi cita', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Mi cita', exact: true })
  await modal.getByRole('button', { name: 'Sí asistiré', exact: true }).click()
  await expect(modal.getByText('La cita cambió. Actualiza sus detalles antes de responder', { exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Cancelar mi cita', exact: true }).click()
  expect(respuestas).toHaveLength(1)
  await modal.getByRole('button', { name: 'Volver', exact: true }).click()
  expect(respuestas).toHaveLength(1)
  await modal.getByRole('button', { name: 'Cancelar mi cita', exact: true }).click()
  await modal.getByRole('button', { name: 'Sí, cancelar cita', exact: true }).click()
  await expect(modal.getByText('Cancelada', { exact: true })).toBeVisible()
  expect(respuestas[1]).toMatchObject({ accion: 'cancelar', confirmado: true })
  await expect(modal.getByRole('button', { name: 'Sí asistiré', exact: true })).toHaveCount(0)
})


test('Mis datos permite editar nacimiento, género y contacto de emergencia y conserva el formulario si hay conflicto', async ({ page }) => {
 const {datos}=await preparar(page), escrituras:any[]=[]
 let fallo=true,version='a'.repeat(32),personales={fechaNacimiento:'1996-04-03',genero:'F',contactoEmergencia:'Contacto propio',telefonoEmergencia:'9617654321'}
 await page.route('**/api/cuenta',r=>{
  if(r.request().method()==='PATCH'){
   const b=r.request().postDataJSON();escrituras.push(b)
   if(fallo){fallo=false;version='c'.repeat(32);personales.contactoEmergencia='Contacto de recepción';return r.fulfill({status:409,json:{error:'Tus datos cambiaron en recepción. Revisa el perfil.'}})}
   personales={fechaNacimiento:b.fechaNacimiento,genero:b.genero,contactoEmergencia:b.contactoEmergencia,telefonoEmergencia:b.telefonoEmergencia};version='b'.repeat(32)
   Object.assign(datos.perfil,{nombre:b.nombre,telefono:b.telefono,fecha_nacimiento:b.fechaNacimiento,genero:b.genero,contacto_emergencia:b.contactoEmergencia,telefono_emergencia:b.telefonoEmergencia})
   return r.fulfill({json:{ok:true,nombre:b.nombre,telefono:b.telefono,paciente:{...personales,version}}})
  }
  return r.fulfill({json:{cuenta:{nombre:datos.perfil.nombre,telefono:datos.perfil.telefono,correo:'mariana@example.test',rol:'paciente',paciente:{...personales,version},preferencias:{},sesion:{jwtVerificado:true,expira:null}}}})
 })
 await page.getByRole('button',{name:'Mis datos',exact:true}).click();await page.getByRole('button',{name:'Editar mis datos',exact:true}).click()
 const modal=page.getByRole('dialog',{name:'Mi perfil',exact:true})
 await expect(modal.getByLabel('Fecha de nacimiento')).toHaveValue('1996-04-03')
 await modal.getByLabel('Fecha de nacimiento').fill('1996-04-04');await modal.getByRole('combobox',{name:'Género',exact:true}).selectOption('O')
 await modal.getByLabel('Nombre del contacto de emergencia').fill('Contacto actualizado');await modal.getByLabel('Teléfono de emergencia',{exact:true}).fill('5551234567')
 await expect(modal.getByLabel('Correo de acceso')).toHaveJSProperty('readOnly',true)
 await modal.getByRole('button',{name:'Guardar perfil',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('cambiaron en recepción')
 await expect(modal.getByLabel('Nombre del contacto de emergencia')).toHaveValue('Contacto actualizado')
 await expect(modal.getByRole('button',{name:'Descartar mis cambios y cargar datos actuales'})).toBeVisible()
 await modal.getByRole('button',{name:'Descartar mis cambios y cargar datos actuales'}).click();await expect(modal.getByLabel('Nombre del contacto de emergencia')).toHaveValue('Contacto de recepción')
 await modal.getByLabel('Fecha de nacimiento').fill('1996-04-04');await modal.getByRole('combobox',{name:'Género',exact:true}).selectOption('O');await modal.getByLabel('Nombre del contacto de emergencia').fill('Contacto actualizado');await modal.getByLabel('Teléfono de emergencia',{exact:true}).fill('5551234567')
 await modal.getByRole('button',{name:'Guardar perfil',exact:true}).click();await expect(modal.getByRole('status')).toContainText('actualizó')
 expect(escrituras[1]).toMatchObject({fechaNacimiento:'1996-04-04',genero:'O',contactoEmergencia:'Contacto actualizado',telefonoEmergencia:'5551234567',version:'c'.repeat(32)})
 await modal.getByRole('button',{name:'Cerrar',exact:true}).last().click();await expect(page.getByText('Contacto actualizado',{exact:true})).toBeVisible()
 await page.screenshot({path:'.herramientas/mis-datos-actualizados.png',fullPage:true})
})

test('el formulario personal del paciente funciona en móvil con guardado accesible', async ({page})=>{
 await preparar(page)
 await page.route('**/api/cuenta',r=>r.fulfill({json:{cuenta:{nombre:'Mariana Torres',telefono:'9611234567',correo:'mariana@example.test',rol:'paciente',paciente:{fechaNacimiento:'1996-04-03',genero:'F',contactoEmergencia:'',telefonoEmergencia:'',version:'a'.repeat(32)},preferencias:{},sesion:{jwtVerificado:true,expira:null}}}}))
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Abrir menú',exact:true}).click();await page.getByRole('button',{name:'Mis datos',exact:true}).click();await page.getByRole('button',{name:'Editar mis datos',exact:true}).click()
 const modal=page.getByRole('dialog',{name:'Mi perfil',exact:true});await modal.getByLabel('Teléfono de emergencia',{exact:true}).fill('5551234567')
 await expect(modal.getByRole('button',{name:'Guardar perfil',exact:true})).toBeInViewport()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'.herramientas/mis-datos-movil.png',fullPage:true})
})
