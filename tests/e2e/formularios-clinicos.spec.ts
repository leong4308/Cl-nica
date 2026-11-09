import { test, expect, type Page } from '@playwright/test'

async function preparar(page: Page, modulo: string) {
  const usuario = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'prueba@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: usuario.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma-prueba`
  const paciente = { id: 1, usuario_id: 2, genero: 'F', fecha_nacimiento: '1995-04-10', notas_medicas: '', esta_activo: true, usuarios: { nombre_completo: 'Paciente de prueba', correo: 'paciente@example.test', telefono: '5555555555' } }
  const medico = { id: 1, usuarios: { nombre_completo: 'Dra. de prueba' } }
  const cita = { id: 1, motivo: 'Seguimiento', inicio: '2026-11-05T12:00:00Z', fin: '2026-11-05T12:50:00Z', estado: 'atendida', perfiles_pacientes: paciente, perfiles_medicos: medico }
  const expediente = { id: 1, cita_id: 1, diagnostico: 'Diagnóstico registrado', receta: 'Receta registrada', notas_doctor: 'Evolución registrada', creado_en: '2026-11-05T12:00:00Z', citas: cita }
  const orden = { id: 1, descripcion: 'Indicación registrada', instrucciones: 'Instrucciones registradas', estado: 'prescrita', tipo_orden: 'analisis', episodio_id: 1, fecha_prescripcion: '2026-11-05T12:00:00Z', episodios_medicos: { tipo_episodio: 'Evolución', perfiles_medicos: medico } }
  const escrituras: { ruta: string; cuerpo: string }[] = []
  let subidas = 0
  let fallarPrimeraSubida = false
  await page.route('**/auth/v1/**', async (route) => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/user') ? usuario : { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'prueba', user: usuario } }))
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const tabla = new URL(req.url()).pathname.split('/').pop()
    let data: object[] = []
    if (tabla === 'usuarios') data = [{ id: 1, auth_user_id: usuario.id, correo: usuario.email, nombre_completo: 'Administrador de prueba', rol: 'admin', esta_activo: true }]
    if (tabla === 'perfiles_pacientes') data = [paciente]
    if (tabla === 'citas') data = [cita]
    if (tabla === 'expedientes') data = [expediente]
    if (tabla === 'ordenes_medicas') data = [orden]
    if (tabla === 'catalogo_analisis') data = [{ id: 1, nombre: 'Estudio de prueba', requiere_ayuno: false }]
    if (tabla === 'internaciones') data = [{ id: 1, estado: 'activa', perfiles_pacientes: paciente, perfiles_medicos: medico, habitaciones: { numero: '101' }, camas: { numero: 'A' }, episodios_medicos: [{ id: 1 }] }]
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { escrituras.push({ ruta: `/rest/v1/${tabla}`, cuerpo: req.postData() ?? '' }); data = [{ id: 99 }] }
    await route.fulfill({ json: req.headers().accept?.includes('vnd.pgrst.object') ? data[0] ?? null : data, headers: { 'content-range': `0-${Math.max(data.length - 1, 0)}/${data.length}` } })
  })
  await page.route('**/api/expedientes', async (route) => {
    escrituras.push({ ruta: '/api/expedientes', cuerpo: route.request().postData() ?? '' })
    await route.fulfill({ json: { ok: true, data: [{ id: 99 }] } })
  })
  await page.route('**/api/documentos-clinicos/**', async (route) => {
    if (route.request().method() === 'POST') {
      subidas++
      escrituras.push({ ruta: new URL(route.request().url()).pathname, cuerpo: route.request().postDataBuffer()?.toString() ?? '' })
      const falla = fallarPrimeraSubida && subidas === 1
      await route.fulfill({ status: falla ? 500 : 200, json: falla ? { error: 'Fallo de prueba' } : { ok: true } })
    } else await route.fulfill({ json: { archivos: [] } })
  })
  await page.goto('/')
  await page.locator('input[type=email]').fill(usuario.email)
  await page.locator('input[type=password]').fill('ClaveDePrueba123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('button', { name: modulo, exact: true }).click()
  return { escrituras, fallarSubida: () => { fallarPrimeraSubida = true } }
}

for (const modulo of ['Expedientes', 'Órdenes médicas']) {
  test(`${modulo}: pasar a edición no guarda y precarga los campos`, async ({ page }) => {
    const { escrituras } = await preparar(page, modulo)
    await page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Ver detalle' }) }).first().getByRole('button', { name: 'Ver detalle' }).click()
    const modal = page.getByRole('dialog')
    await expect(modal.locator('textarea')).toHaveCount(0)
    await modal.getByRole('button', { name: modulo === 'Expedientes' ? 'Editar expediente' : 'Modificar orden', exact: true }).click()
    await expect(modal.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    await expect(modal.getByLabel(modulo === 'Expedientes' ? 'Diagnóstico clínico' : 'Descripción de la orden')).toHaveValue(modulo === 'Expedientes' ? 'Diagnóstico registrado' : 'Indicación registrada')
    await expect(modal.getByLabel(modulo === 'Expedientes' ? 'Notas clínicas y evolución' : 'Instrucciones clínicas / Posología')).toHaveValue(modulo === 'Expedientes' ? 'Evolución registrada' : 'Instrucciones registradas')
    expect(escrituras).toHaveLength(0)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await modal.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false)
    await expect(modal.getByRole('button', { name: 'Guardar cambios' })).toBeInViewport()
  })
}

test('nuevo expediente adjunta al ID devuelto y rechaza PDF de más de 2 MB', async ({ page }) => {
  const { escrituras } = await preparar(page, 'Expedientes')
  await page.getByRole('button', { name: 'Nuevo expediente', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Diagnóstico médico').fill('Diagnóstico de prueba')
  await modal.getByLabel('Seleccionar PDF').setInputFiles({ name: 'grande.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2097153) })
  await expect(modal.getByRole('alert')).toContainText('2 MB')
  await modal.getByLabel('Seleccionar PDF').setInputFiles({ name: 'informe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nDocumento de prueba') })
  await modal.getByRole('button', { name: 'Guardar expediente', exact: true }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras.map((e) => e.ruta)).toEqual(['/api/expedientes', '/api/documentos-clinicos/expedientes/99'])
})

test('reintentar el PDF de una orden no crea otra orden', async ({ page }) => {
  const { escrituras, fallarSubida } = await preparar(page, 'Órdenes médicas')
  fallarSubida()
  await page.getByRole('button', { name: 'Nueva orden', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Seleccionar PDF').setInputFiles({ name: 'informe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nDocumento de prueba') })
  await modal.getByRole('button', { name: 'Emitir orden médica', exact: true }).click()
  await expect(modal.getByRole('alert')).toContainText('La orden ya se guardó')
  await modal.getByRole('button', { name: 'Adjuntar PDF pendiente', exact: true }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras.filter((e) => e.ruta === '/rest/v1/ordenes_medicas')).toHaveLength(1)
  expect(escrituras.filter((e) => e.ruta === '/api/documentos-clinicos/ordenes/99')).toHaveLength(2)
})

test('pacientes conserva el formulario y su perfil sin carga de PDF', async ({ page }) => {
  await preparar(page, 'Pacientes')
  await page.getByRole('button', { name: 'Nuevo paciente', exact: true }).click()
  let modal = page.getByRole('dialog')
  await expect(modal.locator('input[type=file]')).toHaveCount(0)
  await modal.getByLabel('Nombre completo').fill('Paciente de prueba')
  await expect(modal.getByRole('button', { name: 'Guardar paciente' })).toBeEnabled()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await modal.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false)
  await expect(modal.getByRole('button', { name: 'Guardar paciente' })).toBeInViewport()
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Ver detalle' }) }).first().getByRole('button', { name: 'Ver detalle' }).click()
  modal = page.getByRole('dialog')
  await expect(modal.getByRole('tab', { name: 'Datos del paciente' })).toHaveAttribute('aria-selected', 'true')
  await expect(modal.locator('input[type=file]')).toHaveCount(0)
})
