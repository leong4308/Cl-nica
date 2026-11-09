import { test, expect, type Page } from '@playwright/test'
import cuentas from '../../lib/cuenta/cuentas-prueba.json'

async function preparar(page: Page, rol = 'admin', habilitado = true, retrasar = false) {
  const elegida = cuentas.find((c) => c.rol === rol)!
  const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: elegida.correo, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })}.firma-prueba`
  const ingresos: { email: string; password: string }[] = []
  let liberar!: () => void
  const puerta = new Promise<void>((resolve) => { liberar = resolve })
  await page.route('**/api/accesos-prueba', async (route) => {
    if (retrasar) await puerta
    await route.fulfill({ json: habilitado ? { habilitado: true, cuentas, clave: 'Clinica123*' } : { habilitado: false } })
  })
  await page.route('**/auth/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user })
    if (url.searchParams.get('grant_type') === 'password') ingresos.push(route.request().postDataJSON())
    return route.fulfill({ json: { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'refresh-prueba', user } })
  })
  await page.route('**/rest/v1/**', async (route) => {
    const tabla = new URL(route.request().url()).pathname.split('/').pop()
    const data = tabla === 'usuarios' ? [{ id: 3, auth_user_id: user.id, nombre_completo: elegida.nombre, correo: user.email, rol, esta_activo: true }] : tabla === 'perfiles_medicos' && rol === 'medico' ? [{ id: 1, clinica_id: 1 }] : []
    await route.fulfill({ json: data, headers: { 'content-range': `0-0/${data.length}` } })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  return { ingresos, liberar, elegida }
}

for (const cuenta of cuentas) {
  test(`${cuenta.etiqueta}: autocompleta y autentica con el rol guardado`, async ({ page }) => {
    const { ingresos } = await preparar(page, cuenta.rol)
    const acceso = page.getByRole('button', { name: `Usar cuenta de ${cuenta.etiqueta.toLocaleLowerCase('es')}`, exact: true })
    await acceso.click()
    await expect(page.getByRole('textbox', { name: 'Correo electrónico', exact: true })).toHaveValue(cuenta.correo)
    await expect(page.locator('input[autocomplete=current-password]')).toHaveValue('Clinica123*')
    await expect(acceso).toHaveAttribute('aria-pressed', 'true')
    expect(ingresos).toHaveLength(0)
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Menú de usuario' })).toBeVisible()
    expect(ingresos).toHaveLength(1)
    expect(ingresos[0]).toMatchObject({ email: cuenta.correo, password: 'Clinica123*' })
    if (cuenta.rol === 'enfermero' || cuenta.rol === 'recepcionista') await expect(page.getByRole('heading', { name: `Hola, ${cuenta.nombre}` })).toBeVisible()
    if (cuenta.rol === 'medico') await expect(page.getByRole('button', { name: 'Mi Consulta', exact: true })).toBeVisible()
    if (cuenta.rol !== 'admin') await expect(page.getByRole('button', { name: 'Usuarios', exact: true })).toHaveCount(0)
  })
}

test('ocultar accesos conserva el ingreso manual', async ({ page }) => {
  const { ingresos } = await preparar(page, 'admin', false)
  await expect(page.getByRole('region', { name: 'Accesos de prueba por rol' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill('manual@example.test')
  await page.locator('input[autocomplete=current-password]').fill('Manual123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Menú de usuario' })).toBeVisible()
  expect(ingresos[0]).toMatchObject({ email: 'manual@example.test', password: 'Manual123*' })
})

test('cargar accesos tarde no sobrescribe credenciales escritas manualmente', async ({ page }) => {
  const { liberar } = await preparar(page, 'admin', true, true)
  await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill('mi-cuenta@example.test')
  await page.locator('input[autocomplete=current-password]').fill('MiClave123*')
  liberar()
  await expect(page.getByRole('region', { name: 'Accesos de prueba por rol' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Correo electrónico', exact: true })).toHaveValue('mi-cuenta@example.test')
  await expect(page.locator('input[autocomplete=current-password]')).toHaveValue('MiClave123*')
})

test('seleccionar otra cuenta limpia errores y permite editar los datos', async ({ page }) => {
  const { ingresos } = await preparar(page)
  await page.route('**/auth/v1/token*', (route) => route.fulfill({ status: 400, json: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }))
  await page.getByRole('button', { name: 'Usar cuenta de administrador', exact: true }).click()
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('Correo o contraseña incorrectos')
  await page.getByRole('button', { name: 'Usar cuenta de enfermero', exact: true }).click()
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0)
  await page.locator('input[autocomplete=current-password]').fill('OtraClave')
  await expect(page.getByRole('button', { name: 'Usar cuenta de enfermero', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(ingresos).toHaveLength(0)
})

test('los accesos se adaptan al ancho de un teléfono', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await preparar(page)
  await page.getByRole('button', { name: 'Usar cuenta de recepcionista', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Correo electrónico', exact: true })).toHaveValue('recepcionista@clinicanova.com')
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, pantalla: innerWidth }))
  expect(ancho.doc).toBeLessThanOrEqual(ancho.pantalla + 1)
})
test('enfocar un campo impide que la carga tardía inserte datos mientras se escribe', async ({ page }) => {
  const { liberar } = await preparar(page, 'admin', true, true)
  const correo = page.getByRole('textbox', { name: 'Correo electrónico', exact: true })
  await correo.focus()
  liberar()
  await expect(page.getByRole('region', { name: 'Accesos de prueba por rol' })).toBeVisible()
  await expect(correo).toHaveValue('')
  await correo.fill('manual@example.test')
  await expect(correo).toHaveValue('manual@example.test')
})
