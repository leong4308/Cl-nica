import { test, expect, type Page } from '@playwright/test'

// Las solicitudes de datos y las escrituras se simulan para no alterar resultados clínicos.
async function preparar(page: Page, rol = 'admin') {
  const usuario = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'prueba@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: usuario.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma-de-prueba`
  const solicitudes = [
    { id: 15, estado_analisis: 'completado', fecha_solicitud: '2026-11-05T12:00:00Z', fecha_resultado: '2026-11-06T12:00:00Z', resultado: 'Glucosa: 92 mg/dL\nInterpretación registrada.', observaciones: 'Muestra sin hemólisis.', archivo_resultado: '15/informe.pdf', catalogo_analisis: { nombre: 'Glucosa en ayuno' }, ordenes_medicas: { id: 16 } },
    { id: 13, estado_analisis: 'en proceso', fecha_solicitud: '2026-10-26T12:00:00Z', fecha_resultado: null, resultado: null, observaciones: null, archivo_resultado: null, catalogo_analisis: { nombre: 'Perfil lipídico' }, ordenes_medicas: { id: 14 } },
  ]
  await page.route('**/auth/v1/**', async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({ json: url.pathname.endsWith('/user') ? usuario : { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'refresh-de-prueba', user: usuario } })
  })
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const tabla = url.pathname.split('/').pop()
    let data: object[] = []
    if (tabla === 'usuarios') data = [{ id: 1, auth_user_id: usuario.id, correo: usuario.email, nombre_completo: 'Usuario de prueba', rol }]
    if (tabla === 'solicitudes_analisis') data = solicitudes.filter((s) => !url.searchParams.get('id') || url.searchParams.get('id') === `eq.${s.id}`)
    await route.fulfill({ json: data, headers: { 'content-range': `0-${Math.max(data.length - 1, 0)}/${data.length}` } })
  })
  await page.goto('/')
  await page.locator('input[type=email]').fill(usuario.email)
  await page.locator('input[type=password]').fill('ClaveDePrueba123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('button', { name: 'Laboratorio', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: 'LAB-0015' })).toBeVisible()
}

test('ver abre el laboratorio exacto en modo de solo lectura', async ({ page }) => {
  await preparar(page)
  await page.getByRole('row').filter({ hasText: 'LAB-0015' }).getByRole('button', { name: 'Ver detalle' }).click()
  const modal = page.getByRole('dialog', { name: 'Visualización de resultados' })
  await expect(modal.getByText('LAB-0015', { exact: true })).toBeVisible()
  await expect(modal.getByText(/Glucosa: 92 mg\/dL/)).toBeVisible()
  await expect(modal.getByText('Muestra sin hemólisis.')).toBeVisible()
  await expect(modal.getByRole('link', { name: /Abrir PDF/ })).toHaveAttribute('href', '/api/laboratorio/15')
  await expect(modal.locator('textarea, input[type=file]')).toHaveCount(0)
  await expect(modal.getByRole('button', { name: /Guardar/ })).toHaveCount(0)
})

test('editar precarga el resultado y exige aceptar la advertencia de completado', async ({ page }) => {
  await preparar(page)
  await page.getByRole('row').filter({ hasText: 'LAB-0015' }).getByRole('button', { name: 'Editar registro' }).click()
  const modal = page.getByRole('dialog', { name: 'Modificar resultados' })
  await expect(modal.getByText('LAB-0015', { exact: true })).toBeVisible()
  await expect(modal.getByLabel('Resultado e interpretación')).toHaveValue('Glucosa: 92 mg/dL\nInterpretación registrada.')
  await expect(modal.getByLabel('Observaciones técnicas')).toHaveValue('Muestra sin hemólisis.')
  await expect(modal.getByRole('radio')).toHaveCount(0)
  const guardar = modal.getByRole('button', { name: 'Guardar cambios' })
  await expect(guardar).toBeDisabled()
  await modal.getByRole('checkbox', { name: /Entiendo la advertencia/ }).check()
  await expect(guardar).toBeEnabled()
  await modal.getByLabel('Resultado e interpretación').fill('Resultado corregido')
  let destino = ''
  let cuerpo = ''
  await page.route('**/api/laboratorio/*', async (route) => {
    destino = new URL(route.request().url()).pathname
    cuerpo = route.request().postDataBuffer()?.toString() ?? ''
    await route.fulfill({ json: { ok: true } })
  })
  await guardar.click()
  await expect(modal).toHaveCount(0)
  expect(destino).toBe('/api/laboratorio/15')
  expect(cuerpo).toContain('Resultado corregido')
  expect(cuerpo).toContain('Muestra sin hemólisis.')
  expect(cuerpo).not.toContain('filename=')
})

test('permite adjuntar PDF sin texto y rechaza un archivo con contenido inválido', async ({ page }) => {
  await preparar(page)
  await page.getByRole('row').filter({ hasText: 'LAB-0013' }).getByRole('button', { name: 'Editar registro' }).click()
  const modal = page.getByRole('dialog', { name: 'Modificar resultados' })
  await expect(modal.getByText('LAB-0013', { exact: true })).toBeVisible()
  await expect(modal.getByRole('checkbox', { name: /Entiendo la advertencia/ })).toHaveCount(0)
  const guardar = modal.getByRole('button', { name: 'Guardar cambios' })
  await expect(guardar).toBeDisabled()
  await modal.getByLabel('Adjuntar resultado en PDF').setInputFiles({ name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('archivo sin contenido PDF') })
  await expect(modal.getByRole('alert')).toContainText('PDF válido')
  await expect(guardar).toBeDisabled()
  await modal.getByLabel('Adjuntar resultado en PDF').setInputFiles({ name: 'reporte.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nReporte de prueba') })
  await expect(modal.getByText(/Se adjuntará al guardar/)).toBeVisible()
  await expect(guardar).toBeEnabled()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await modal.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false)
  let cuerpo = ''
  await page.route('**/api/laboratorio/*', async (route) => {
    expect(new URL(route.request().url()).pathname).toBe('/api/laboratorio/13')
    cuerpo = route.request().postDataBuffer()?.toString() ?? ''
    await route.fulfill({ json: { ok: true } })
  })
  await guardar.click()
  await expect(modal).toHaveCount(0)
  expect(cuerpo).toContain('filename="reporte.pdf"')
  expect(cuerpo).toContain('%PDF-1.7')
})

test('enfermería también abre las acciones del laboratorio seleccionado', async ({ page }) => {
  await preparar(page, 'enfermero')
  await page.getByRole('row').filter({ hasText: 'LAB-0013' }).getByRole('button', { name: 'Ver detalle' }).click()
  const modal = page.getByRole('dialog', { name: 'Visualización de resultados' })
  await expect(modal.getByText('LAB-0013', { exact: true })).toBeVisible()
})
