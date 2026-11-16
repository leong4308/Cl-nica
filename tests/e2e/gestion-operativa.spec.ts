import { test, expect, type Page } from './fixture'
const version = 'a'.repeat(32), ofertaId = '11111111-1111-4111-8111-111111111113'
async function entrar(page: Page, rol: string) {
  await page.context().grantPermissions(['local-network-access'])
  await page.clock.setFixedTime(new Date('2026-11-12T18:00:00Z'))
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'cuenta@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url'), token = `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })}.prueba`
  await page.route('**/auth/v1/**', r => r.fulfill({ json: r.request().url().endsWith('/user') ? user : { user, access_token: token, refresh_token: 'simulado', expires_in: 3600, token_type: 'bearer' } }))
  await page.route('**/rest/v1/**', r => r.fulfill({ json: new URL(r.request().url()).pathname.endsWith('/usuarios') ? [{ id: 1, auth_user_id: user.id, nombre_completo: 'Cuenta de prueba', rol, esta_activo: true }] : [] }))
  await page.route('**/api/pacientes', r => r.fulfill({ json: { pacientes: [] } }))
  await page.goto('/'); await page.locator('input[type=email]').fill(user.email); await page.locator('input[type=password]').fill('ClaveSimulada123*'); await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  if ((page.viewportSize()?.width ?? 1280) < 1024) await page.getByRole('button', { name: 'Abrir menú', exact: true }).click()
  await expect(page.getByRole('button', { name: rol === 'paciente' ? 'Mi inicio' : 'Citas', exact: true }).first()).toBeVisible()
}
function salaDatos() { return { clinicas: [{ id: 1, nombre: 'Sede de prueba' }], medicos: [{ id: 1, nombre: 'Médico de prueba', clinicaId: 1, asignado: false }], salas: [] as any[], turnos: [] as any[] } }
test('administración registra consultorio y turno, preserva el formulario ante cruces', async ({ page }) => {
  const datos = salaDatos(), escrituras: any[] = []; let conflicto = true
  await page.route('**/api/gestion/consultorios', r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: datos })
    const b = r.request().postDataJSON(); escrituras.push(b)
    if (b.accion === 'sala') datos.salas.push({ id: 1, clinicaId: 1, nombre: b.datos.nombre, ubicacion: b.datos.ubicacion, activo: true, version })
    if (b.accion === 'turno') { if (conflicto) { conflicto = false; return r.fulfill({ status: 409, json: { error: 'El consultorio ya tiene una asignación en ese horario.' } }) } datos.turnos.push({ ...b.datos, id: 1, medico: 'Médico de prueba', activo: true, version }) }
    return r.fulfill({ json: { id: 1, mensaje: 'Asignaciones guardadas.' } })
  })
  await entrar(page, 'admin'); await page.getByRole('button', { name: 'Consultorios', exact: true }).click()
  await page.getByRole('button', { name: 'Crear consultorio', exact: true }).click(); await page.getByLabel('Nombre del consultorio').fill('Consultorio 201'); await page.getByLabel('Ubicación', { exact: true }).fill('Primer piso')
  await page.getByRole('button', { name: 'Guardar consultorio o asignación' }).click(); await expect(page.getByRole('heading', { name: 'Consultorio 201', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Asignar consultorio', exact: true }).click(); await page.getByRole('combobox', { name: 'Médico', exact: true }).selectOption('1'); await page.getByRole('button', { name: 'Guardar consultorio o asignación' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'ya tiene una asignación' })).toBeVisible(); await expect(page.getByRole('combobox', { name: 'Médico', exact: true })).toHaveValue('1')
  await page.getByRole('button', { name: 'Guardar consultorio o asignación' }).click(); await page.getByRole('button', { name: 'Ver asignaciones', exact: true }).click(); await expect(page.getByRole('button', { name: /Desactivar asignación de/ })).toBeVisible()
  expect(escrituras[1].clave).toBe(escrituras[2].clave)
  await page.screenshot({ path: '.herramientas/gestion-consultorios.png', fullPage: true })
})
test('recepción consulta consultorios sin editarlos y confirma el reintento del aviso', async ({ page }) => {
  const datos = salaDatos(); datos.salas.push({ id: 1, clinicaId: 1, nombre: 'Consultorio 201', ubicacion: 'Planta alta', activo: true, version })
  let escrituras = 0
  const envios = { ahora: '2026-11-12T18:00:00Z', trabajadorActivo: true, correoConfigurado: true, telegramConfigurado: true, correoPrueba: true, envios: [{ id: 5, canal: 'correo', estado: 'fallido', intentos: 5, reintentos: 0, codigo: 'HTTP_403', aceptado: null, fecha: '2026-11-12T17:00:00Z', titulo: 'Recordatorio de cita', destinatario: 'Paciente de prueba', contacto: 'paciente@example.test' }] }
  await page.route('**/api/gestion/consultorios', r => r.fulfill({ json: datos }))
  await page.route('**/api/gestion/envios**', r => { if (r.request().method() === 'POST') { escrituras++; return r.fulfill({ status: 400, json: { error: 'El aviso ya venció. No se reenviará.' } }) } return r.fulfill({ json: envios }) })
  await entrar(page, 'recepcionista'); await page.getByRole('button', { name: 'Consultorios', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Consultorio 201', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Crear consultorio' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Comunicaciones', exact: true }).click(); await page.getByRole('button', { name: 'Reintentar aviso', exact: true }).click(); expect(escrituras).toBe(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar reintento', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ya venció'); expect(escrituras).toBe(1)
  await expect(page.getByRole('button', { name: 'Reportes', exact: true })).toHaveCount(0)
})
test('reporte administrativo exporta PDF y Excel con las mediciones y su muestra', async ({ page }) => {
  await page.route('**/api/gestion/reportes**', r => r.fulfill({ json: { desde: '2026-11-01', hasta: '2026-11-12', total: 5, atendidas: 3, canceladas: 1, inasistencias: 1, porDia: [{ dia: '2026-11-01', total: 5, atendidas: 3 }], porMedico: [{ id: 1, medico: 'Médico de prueba', total: 5, atendidas: 3, canceladas: 1, inasistencias: 1, pendientes: 0, espera: 12, muestra_espera: 2, duracion: null, muestra_duracion: 0 }], medicos: [{ id: 1, nombre: 'Médico de prueba' }] } }))
  await entrar(page, 'admin'); await page.getByRole('button', { name: 'Reportes', exact: true }).click(); await expect(page.getByRole('cell', { name: '12 min · n=2', exact: true })).toBeVisible(); await expect(page.getByRole('cell', { name: 'Sin registros', exact: true })).toBeVisible()
  const popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Informe PDF', exact: true }).click(); const pdf = await popup; await expect(pdf.getByRole('heading', { name: 'Actividad y atención médica' })).toBeVisible(); await pdf.close()
  const descarga = page.waitForEvent('download'); await page.getByRole('button', { name: 'Descargar Excel', exact: true }).click(); expect((await descarga).suggestedFilename()).toMatch(/actividad-.*\.xlsx$/)
  await page.screenshot({ path: '.herramientas/gestion-reportes.png', fullPage: true })
})
test('médico indica un control sin llamar a reservar citas', async ({ page }) => {
  const datos = { pacientes: [{ id: 1, nombre: 'Paciente de prueba' }], controles: [] as any[], citas: [] }, escrituras: any[] = []; let reservas = 0
  await page.route('**/api/gestion/controles', r => { if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); escrituras.push(b); datos.controles.push({ id: 1, pacienteId: 1, paciente: 'Paciente de prueba', medicoId: 1, medico: 'Médico de prueba', ...b.datos, estado: 'pendiente', version }); return r.fulfill({ json: { id: 1, mensaje: 'Control indicado sin reservar una cita.' } }) } return r.fulfill({ json: datos }) })
  await page.route('**/api/citas/reservar**', r => { reservas++; return r.fulfill({ status: 500, json: {} }) })
  await entrar(page, 'medico'); await page.getByRole('button', { name: 'Controles', exact: true }).click(); await page.getByRole('button', { name: 'Programar control', exact: true }).click()
  await page.getByLabel('Paciente de mi atención').selectOption('1'); await page.getByLabel('Fecha indicada para el control').fill('2026-11-20'); await page.getByLabel('Indicaciones para el paciente').fill('Traer estudios indicados en consulta')
  await page.getByRole('button', { name: 'Guardar control sin reservar cita' }).click(); await expect(page.getByRole('heading', { name: 'Control de seguimiento', exact: true })).toBeVisible(); expect(reservas).toBe(0); expect(escrituras).toHaveLength(1)
  await expect(page.getByRole('button', { name: 'Reportes', exact: true })).toHaveCount(0)
})
test('paciente acepta una oferta explícitamente y conserva el diálogo si el turno se ocupa', async ({ page }) => {
  const datos = { pacientes: [{ id: 1, nombre: 'Paciente de prueba', cuenta: true }], medicos: [{ id: 1, nombre: 'Médico de prueba' }], citas: [], solicitudes: [{ id: 1, pacienteId: 1, paciente: 'Paciente de prueba', medicoId: 1, medico: 'Médico de prueba', citaId: null, desde: '2026-11-13', hasta: '2026-11-20', inicio: '08:00', fin: '20:00', estado: 'activa', version }], ofertas: [{ id: ofertaId, entradaId: 1, pacienteId: 1, inicio: '2026-11-13T16:00:00Z', fin: '2026-11-13T16:20:00Z', vence: '2026-11-12T18:20:00Z', estado: 'pendiente' }] }, escrituras: any[] = []
  await page.route('**/api/gestion/espera', r => { if (r.request().method() === 'POST') { escrituras.push(r.request().postDataJSON()); return r.fulfill({ status: 409, json: { error: 'El horario ya se ocupó. Tu cita actual se conserva.' } }) } return r.fulfill({ json: datos }) })
  await entrar(page, 'paciente'); await page.getByRole('button', { name: 'Lista de espera', exact: true }).click(); await page.getByRole('button', { name: 'Aceptar horario', exact: true }).click(); expect(escrituras).toHaveLength(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar aceptación' }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Tu cita actual se conserva'); expect(escrituras[0].datos).toEqual({ ofertaId })
  await page.screenshot({ path: '.herramientas/gestion-espera-paciente.png', fullPage: true })
})
test('paciente reserva su control con el médico indicado y asocia la cita que acaba de crear', async ({ page }) => {
  const datos = { pacientes: [{ id: 1, nombre: 'Paciente de prueba' }], controles: [{ id: 1, pacienteId: 1, paciente: 'Paciente de prueba', medicoId: 1, medico: 'Médico de prueba', fecha: '2026-11-13', titulo: 'Control indicado', indicaciones: 'Traer estudios', estado: 'pendiente', citaId: null as number | null, nota: null, version }], citas: [] }, escrituras: any[] = []
  await page.route('**/api/gestion/controles', r => { if (r.request().method() === 'POST') { const b = r.request().postDataJSON(); escrituras.push(b); datos.controles[0].citaId = b.datos.citaId; datos.controles[0].estado = 'cita_agendada'; return r.fulfill({ json: { mensaje: 'Cita asociada.' } }) } return r.fulfill({ json: datos }) })
  await page.route('**/api/citas/reservar**', r => r.fulfill({ json: r.request().method() === 'POST' ? { id: 55, mensaje: 'Cita reservada.' } : new URL(r.request().url()).search ? { configurado: true, turnos: [{ inicio: '2026-11-13T16:00:00Z', fin: '2026-11-13T16:20:00Z' }] } : { paciente: { nombre: 'Paciente de prueba', correo: 'paciente@example.test' }, medicos: [{ id: 1, nombre: 'Médico de prueba', especialidad: 'General', clinica: 'Clínica', publicado: true }] } }))
  await entrar(page, 'paciente'); await page.getByRole('button', { name: 'Mis controles', exact: true }).click(); await page.getByRole('button', { name: 'Buscar cita para este control' }).click()
  const modal = page.getByRole('dialog'); await expect(modal.getByLabel('Médico', { exact: true })).toBeDisabled(); await modal.getByRole('button', { name: '10:00 – 10:20' }).click(); await expect(modal.getByLabel('Motivo de consulta')).toHaveValue('Control indicado'); await modal.getByRole('button', { name: 'Confirmar y agendar' }).click()
  await expect(page.getByText('Cita asociada #55')).toBeVisible(); expect(escrituras[0]).toMatchObject({ accion: 'vincular_cita', datos: { id: 1, citaId: 55, version } })
})


test('móvil conserva accesibles el menú de paciente y los formularios nuevos sin desbordar', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 })
 await entrar(page, 'paciente'); await page.getByRole('button', { name: 'Lista de espera', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'Lista de espera', exact: true })).toBeVisible()
 await page.getByRole('button', { name: 'Solicitar horario en espera', exact: true }).click()
 await expect(page.getByLabel('Disponible desde')).toBeVisible()
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
 await page.screenshot({ path: '.herramientas/gestion-movil.png', fullPage: true })
 await page.getByRole('button', { name: 'Abrir menú', exact: true }).click(); await page.getByRole('button', { name: 'Mis controles', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'Mis controles', exact: true })).toBeVisible()
})


function tresConsultorios() {
 const nombres=['Dra. Ana López','Dr. Jorge Méndez','Dra. Laura Ruiz']
 const datos={clinicas:[{id:1,nombre:'Clínica Nova - Sede Central'}],medicos:nombres.map((nombre,i)=>({id:i+1,nombre,clinicaId:1,asignado:true})),salas:nombres.map((_,i)=>({id:i+1,clinicaId:1,nombre:'Consultorio '+(i+1),ubicacion:'',activo:true,version})),turnos:[] as any[]}
 const dias=[[0,1,2,4,6],[0,2,3,5,6],[0,1,3,4,5]]
 for(let m=0;m<3;m++)for(const dia of dias[m])for(const [inicio,fin] of m===0?[['08:00:00','20:00:00']]:m===1?[['08:00:00','14:00:00'],['15:00:00','20:00:00']]:[['08:00:00','15:00:00'],['16:00:00','20:00:00']]){
  for(const [desde,hasta] of [['2026-11-01','2027-11-16'],['2027-11-17','2027-11-30']])datos.turnos.push({id:datos.turnos.length+1,consultorioId:m+1,medicoId:m+1,medico:nombres[m],dia,inicio,fin,desde,hasta,activo:true,version})
 }
 return datos
}
test('los tres consultorios muestran la semana completa sin desplazamiento en escritorio',async({page})=>{
 await page.setViewportSize({width:1920,height:950})
 await page.route('**/api/gestion/consultorios',r=>r.fulfill({json:tresConsultorios()}))
 await entrar(page,'recepcionista');await page.getByRole('button',{name:'Consultorios',exact:true}).click()
 for(const ancho of [1920,1366]){
  await page.setViewportSize({width:ancho,height:900})
  for(let i=1;i<=3;i++){
   const tarjeta=page.getByRole('region',{name:'Consultorio '+i,exact:true})
   await expect(tarjeta).toBeVisible();await expect(tarjeta.getByRole('row')).toHaveCount(8)
   await expect(tarjeta.getByText('30 nov 2027',{exact:true})).toBeVisible()
   const caja=await tarjeta.boundingBox();expect(caja!.y+caja!.height).toBeLessThanOrEqual(900)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 }
 await page.setViewportSize({width:1920,height:950});await page.screenshot({path:'.herramientas/consultorios-compacto.png',fullPage:true})
})
test('los periodos completos se consultan por páginas y las renovaciones futuras aparecen programadas',async({page})=>{
 await page.route('**/api/gestion/consultorios',r=>r.fulfill({json:tresConsultorios()}))
 await entrar(page,'recepcionista');await page.getByRole('button',{name:'Consultorios',exact:true}).click()
 await page.getByRole('region',{name:'Consultorio 2',exact:true}).getByRole('button',{name:'Ver asignaciones',exact:true}).click()
 const dialogo=page.getByRole('dialog');await expect(dialogo.getByRole('article')).toHaveCount(8)
 await expect(dialogo.getByText('20 asignaciones · Página 1 de 3')).toBeVisible()
 await dialogo.getByRole('button',{name:'Página siguiente de asignaciones'}).click()
 await expect(dialogo.getByText('Programada',{exact:true}).first()).toBeVisible()
 await expect(dialogo.getByRole('button',{name:/Desactivar/})).toHaveCount(0)
 await dialogo.getByRole('button',{name:'Cerrar detalle',exact:true}).click()
 await page.getByLabel('Consultar fecha',{exact:true}).fill('2027-12-01')
 await expect(page.getByText('Sin horario asignado para esta fecha',{exact:true})).toHaveCount(3)
})
test('en móvil se cambia de consultorio sin recorrer todas las tarjetas ni desbordar la pantalla',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.route('**/api/gestion/consultorios',r=>r.fulfill({json:tresConsultorios()}))
 await entrar(page,'recepcionista');await page.getByRole('button',{name:'Consultorios',exact:true}).click()
 await expect(page.getByRole('complementary')).not.toBeInViewport()
 await page.getByRole('combobox',{name:'Ver consultorio',exact:true}).selectOption('3')
 await expect(page.getByRole('region',{name:'Consultorio 3',exact:true})).toBeVisible()
 await expect(page.getByRole('region',{name:'Consultorio 1',exact:true})).toHaveCount(0)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 await page.screenshot({path:'.herramientas/consultorios-compacto-movil.png',fullPage:true,animations:'disabled'})
})
