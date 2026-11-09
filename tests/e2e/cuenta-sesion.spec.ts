import { test, expect, type Page } from '@playwright/test'

async function preparar(page: Page, rol = 'admin') {
  await page.context().grantPermissions(['local-network-access'])
  const usuario = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'prueba@example.test', app_metadata: {}, user_metadata: {} as Record<string, unknown>, created_at: '2026-01-01T00:00:00Z' }
  const propio = { id: 1, auth_user_id: usuario.id, correo: usuario.email, nombre_completo: 'Usuario de prueba', rol, esta_activo: true }
  const datosPaciente = { id: 7, nombre: 'Paciente de prueba', correo: 'paciente@example.test', telefono: '5555555555', fechaNacimiento: '1990-01-01', genero: 'F', contactoEmergencia: '', telefonoEmergencia: '' }
  let prefs = { textoGrande: false, reducirAnimaciones: false, altoContraste: false, paginaInicio: 'Predeterminada' }
  const solicitudes: { ruta: string; cuerpo: Record<string, unknown> }[] = []
  let renovaciones = 0
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const token = (exp = Math.floor(Date.now() / 1000) + 3600) => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: usuario.id, role: 'authenticated', exp, jti: String(renovaciones) })}.firma-de-prueba`
  await page.route('**/auth/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: usuario })
    if (url.pathname.endsWith('/logout')) return route.fulfill({ json: {} })
    if (url.searchParams.get('grant_type') === 'refresh_token') renovaciones++
    return route.fulfill({ json: { access_token: token(), token_type: 'bearer', expires_in: 3600, refresh_token: 'refresh-prueba', user: usuario } })
  })
  await page.route('**/rest/v1/**', async (route) => {
    const tabla = new URL(route.request().url()).pathname.split('/').pop()
    let data: object[] = []
    if (tabla === 'usuarios') data = [propio]
    if (tabla === 'perfiles_pacientes') data = [{ id: 7, usuario_id: 70, fecha_nacimiento: datosPaciente.fechaNacimiento, genero: datosPaciente.genero, esta_activo: true, notas_medicas: '{"alergias":"Ninguna"}', usuarios: { nombre_completo: datosPaciente.nombre, correo: datosPaciente.correo, telefono: datosPaciente.telefono } }]
    if (tabla === 'perfiles_medicos' && rol === 'medico') data = [{ id: 1, clinica_id: 1 }]
    await route.fulfill({ json: data, headers: { 'content-range': `0-${Math.max(data.length - 1, 0)}/${data.length}` } })
  })
  await page.route('**/api/cuenta', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      solicitudes.push({ ruta: '/api/cuenta', cuerpo: body })
      if (body.accion === 'perfil') propio.nombre_completo = body.nombre
      else { prefs = body.preferencias; usuario.user_metadata.clinica_preferencias = prefs }
      return route.fulfill({ json: { ok: true, preferencias: prefs } })
    }
    await route.fulfill({ json: { cuenta: { nombre: propio.nombre_completo, correo: usuario.email, telefono: '', rol, especialidad: null, creado: usuario.created_at, preferencias: prefs, sesion: { jwtVerificado: true, expira: Math.floor(Date.now() / 1000) + 3600 }, soporte: null } } })
  })
  await page.route('**/api/cuenta/contrasena', async (route) => {
    const body = route.request().postDataJSON()
    solicitudes.push({ ruta: '/api/cuenta/contrasena', cuerpo: body })
    await route.fulfill({ status: body.actual === 'AnteriorCorrecta123*' ? 200 : 400, json: body.actual === 'AnteriorCorrecta123*' ? { ok: true } : { error: 'La contraseña actual es incorrecta.' } })
  })
  await page.route('**/api/pacientes/7', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      solicitudes.push({ ruta: '/api/pacientes/7', cuerpo: body })
      Object.assign(datosPaciente, body)
      return route.fulfill({ json: { ok: true } })
    }
    return route.fulfill({ json: { paciente: datosPaciente } })
  })
  await page.goto('/')
  await page.locator('input[type=email]').fill(usuario.email)
  await page.locator('input[type=password]').fill('ClaveDePrueba123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Menú de usuario' })).toBeVisible()
  // El proxy recibe una navegación anónima; el navegador conserva la sesión ficticia.
  const raiz = new URL(page.url()).origin + '/'
  await page.route(raiz, async (route) => {
    const respuesta = await route.fetch({ headers: { ...route.request().headers(), cookie: '' } })
    await route.fulfill({ response: respuesta })
  })
  return { solicitudes, renovaciones: () => renovaciones, token }
}

async function abrir(page: Page, opcion: string) {
  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('menuitem', { name: opcion, exact: true }).click()
  await expect(page.getByRole('dialog', { name: opcion, exact: true })).toBeVisible()
  return page.getByRole('dialog')
}

test('editar paciente abre la fila correcta y guarda los datos sin PDF', async ({ page }) => {
  const { solicitudes } = await preparar(page)
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click()
  await page.getByRole('row').filter({ hasText: 'Paciente de prueba' }).getByRole('button', { name: 'Editar registro' }).click()
  const modal = page.getByRole('dialog', { name: 'Editar información del paciente' })
  await expect(modal.getByLabel('Fecha de nacimiento')).toHaveValue('1990-01-01')
  await modal.getByLabel('Nombre completo').fill('Paciente actualizado')
  await modal.getByLabel('Teléfono', { exact: true }).fill('5511111111')
  await expect(modal.locator('input[type=file]')).toHaveCount(0)
  await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('actualizada')
  expect(solicitudes[0].ruta).toBe('/api/pacientes/7')
  expect(solicitudes[0].cuerpo.nombre).toBe('Paciente actualizado')
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await expect(page.getByRole('row').filter({ hasText: 'Paciente actualizado' })).toBeVisible()
})

test('mi perfil guarda el nombre y se refleja en el encabezado', async ({ page }) => {
  await preparar(page)
  const modal = await abrir(page, 'Mi perfil')
  await modal.getByLabel('Nombre completo').fill('Perfil actualizado')
  await modal.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('se actualizó')
  await expect(page.locator('header h1')).toContainText('Perfil')
})

test('preferencias se aplican y se conservan al recargar', async ({ page }) => {
  await preparar(page)
  const modal = await abrir(page, 'Preferencias')
  await modal.getByRole('checkbox', { name: /Mayor contraste/ }).check()
  await modal.getByRole('checkbox', { name: /Reducir animaciones/ }).check()
  await modal.getByLabel('Página al iniciar sesión').selectOption('Pacientes')
  await modal.getByRole('button', { name: 'Guardar preferencias', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('se guardaron')
  await expect(page.locator('html')).toHaveAttribute('data-alto-contraste', 'true')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-reducir-animaciones', 'true')
})

test('cambio de contraseña exige coincidencia y muestra los errores del proveedor', async ({ page }) => {
  const { solicitudes } = await preparar(page)
  const modal = await abrir(page, 'Cambiar contraseña')
  await modal.getByLabel('Contraseña actual', { exact: true }).fill('Incorrecta123*')
  await modal.getByLabel('Nueva contraseña', { exact: true }).fill('NuevaClave123*')
  await modal.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('Diferente123*')
  await modal.getByRole('button', { name: 'Actualizar contraseña', exact: true }).click()
  await expect(modal.getByRole('alert')).toContainText('coincidir')
  expect(solicitudes).toHaveLength(0)
  await modal.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('NuevaClave123*')
  await modal.getByRole('button', { name: 'Actualizar contraseña', exact: true }).click()
  await expect(modal.getByRole('alert')).toContainText('actual es incorrecta')
  await modal.getByLabel('Contraseña actual', { exact: true }).fill('AnteriorCorrecta123*')
  await modal.getByRole('button', { name: 'Actualizar contraseña', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('actualizada correctamente')
  await expect(modal.getByLabel('Nueva contraseña', { exact: true })).toHaveValue('')
})

test('renueva JWT automáticamente al vencer y al salir no restaura la sesión', async ({ page, context }) => {
  const e = await preparar(page)
  const cookie = (await context.cookies()).find((c) => c.name.endsWith('-auth-token'))!
  expect(cookie).toBeTruthy()
  const sesion = JSON.parse(Buffer.from(cookie.value.slice('base64-'.length), 'base64url').toString())
  sesion.expires_at = Math.floor(Date.now() / 1000) - 30
  sesion.access_token = e.token(sesion.expires_at)
  await context.addCookies([{ ...cookie, value: 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url') }])
  await page.reload()
  await expect(page.getByRole('button', { name: 'Menú de usuario' })).toBeVisible()
  expect(e.renovaciones()).toBeGreaterThan(0)
  const modal = await abrir(page, 'Configuración')
  await modal.getByRole('button', { name: 'Renovar sesión', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('se renovó')
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible()
})

for (const rol of ['enfermero', 'recepcionista']) {
  test(`${rol}: cuenta y ayuda funcionan desde su interfaz`, async ({ page }) => {
    await preparar(page, rol)
    const modal = await abrir(page, 'Ayuda y soporte')
    await modal.getByLabel('Buscar ayuda').fill('contraseña')
    await expect(modal.getByText('¿Cómo cambio mi contraseña?', { exact: true })).toBeVisible()
    await modal.getByRole('navigation', { name: 'Opciones de cuenta' }).getByRole('button', { name: 'Mi perfil', exact: true }).click()
    await expect(modal.getByLabel('Nombre completo')).toHaveValue('Usuario de prueba')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await modal.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false)
    await expect(modal.getByRole('button', { name: 'Guardar perfil' })).toBeInViewport()
    await modal.getByRole('navigation', { name: 'Opciones de cuenta' }).getByRole('button', { name: 'Preferencias', exact: true }).click()
    await modal.getByLabel('Página al iniciar sesión').selectOption('Pacientes')
    await modal.getByRole('button', { name: 'Guardar preferencias', exact: true }).click()
    await expect(modal.getByRole('status')).toContainText('se guardaron')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible()
  })
}
