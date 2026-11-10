import { simularDirectorioPacientes } from './pacientes-fixture'
import { test, expect, type Page } from '@playwright/test'
import type { DatosHospital, IngresoHospital } from '../../lib/internacion/modelo'
async function preparar(page: Page) {
  const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'prueba@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })}.firma-prueba`
  const base: IngresoHospital = { id: 41, pacienteId: 7, paciente: 'María de prueba', medicoId: 3, medico: 'Dra. de prueba', clinicaId: 1, habitacionId: 100, habitacion: '100', tipoHabitacion: 'Doble', camaId: 10, cama: 'A', ingreso: '2026-11-01T12:00:00Z', alta: null, estado: 'activa', motivo: 'Observación de prueba', diagnostico: 'Diagnóstico registrado', version: '2026-11-01T12:00:00Z' }
  const datos: DatosHospital = { ingresos: [{ ...base }, { ...base, id: 42, pacienteId: 8, paciente: 'Carlos de prueba', camaId: 12, cama: 'C', estado: 'alta', alta: '2026-11-03T12:00:00Z' }], camas: [
    { id: 10, habitacionId: 100, clinicaId: 1, numero: 'A', habitacion: '100', tipo: 'Doble', ocupada: true, paciente: 'María de prueba', internacionId: 41, inconsistente: false },
    { id: 11, habitacionId: 100, clinicaId: 1, numero: 'B', habitacion: '100', tipo: 'Doble', ocupada: false, paciente: null, internacionId: null, inconsistente: false },
    { id: 12, habitacionId: 100, clinicaId: 1, numero: 'C', habitacion: '100', tipo: 'Doble', ocupada: false, paciente: null, internacionId: null, inconsistente: false }], medicos: [{ id: 3, nombre: 'Dra. de prueba', especialidad: 'General', clinicaId: 1 }], pacientes: [{ id: 7, nombre: 'María de prueba', ingresoActivo: true }, { id: 8, nombre: 'Carlos de prueba', ingresoActivo: false }] }
  const escrituras: { id: number; body: any }[] = []
  await simularDirectorioPacientes(page, [])
  await page.route('**/auth/v1/**', (r) => r.fulfill({ json: new URL(r.request().url()).pathname.endsWith('/user') ? user : { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'refresh-prueba', user } }))
  await page.route('**/rest/v1/**', (r) => {
    const tabla = new URL(r.request().url()).pathname.split('/').pop()
    const data = tabla === 'usuarios' ? [{ id: 3, auth_user_id: user.id, nombre_completo: 'Admin de prueba', correo: user.email, rol: 'admin', esta_activo: true }] : []
    return r.fulfill({ json: data, headers: { 'content-range': `0-0/${data.length}` } })
  })
  await page.route('**/api/internacion*', (r) => {
    if (r.request().method() === 'POST') { escrituras.push({ id: 0, body: r.request().postDataJSON() }); return r.fulfill({ json: { id: 43 } }) }
    return r.fulfill({ json: datos })
  })
  await page.route('**/api/internacion/*', async (r) => {
    const id = Number(new URL(r.request().url()).pathname.split('/').pop()), ingreso = datos.ingresos.find((i) => i.id === id)!
    if (r.request().method() === 'PATCH') {
      const body = r.request().postDataJSON(); escrituras.push({ id, body })
      if (body.accion === 'alta') { ingreso.estado = 'alta'; ingreso.alta = '2026-11-09T18:00:00Z' }
      else { ingreso.motivo = body.motivo; ingreso.diagnostico = body.diagnostico; ingreso.camaId = body.camaId }
      await r.fulfill({ json: { id } }); return
    }
    await r.fulfill({ json: { ingreso, movimientos: [{ id: 1, tipo: 'Ingreso', descripcion: 'Observación de prueba', fecha: base.ingreso, autor: 'Profesional de prueba' }] } })
  })
  await page.goto('/')
  await page.locator('input[type=email]').fill(user.email)
  await page.locator('input[type=password]').fill('Prueba123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  if ((page.viewportSize()?.width ?? 1440) < 1024) await page.getByRole('button', { name: 'Abrir menú', exact: true }).click()
  await page.getByRole('button', { name: 'Internación', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Internación y camas' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'María de prueba' })).toBeVisible()
  return { datos, escrituras, modal: page.getByRole('dialog') }
}
test('Ver abre el ingreso correcto en modo lectura y muestra movimientos', async ({ page }) => {
  const { modal, escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Ver hospitalización de María de prueba' }).click()
  await expect(modal.getByRole('heading', { name: 'Detalle de hospitalización' })).toBeVisible()
  await expect(modal.getByRole('heading', { name: 'María de prueba' })).toBeVisible()
  await expect(modal.getByText('ING-0041', { exact: true })).toBeVisible()
  await expect(modal.getByText('Registrado por Profesional de prueba')).toBeVisible()
  await expect(modal.locator('textarea')).toHaveCount(0)
  expect(escrituras).toHaveLength(0)
})
test('Editar precarga y guarda únicamente el ingreso seleccionado con su versión', async ({ page }) => {
  const { modal, escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Editar hospitalización de María de prueba' }).click()
  await expect(modal.getByRole('heading', { name: 'Editar hospitalización' })).toBeVisible()
  await expect(modal.getByLabel(/Motivo del internamiento/)).toHaveValue('Observación de prueba')
  await expect(modal.getByRole('radio', { name: /Cama A/ })).toBeChecked()
  await modal.getByRole('radio', { name: /Cama B/ }).check()
  await modal.getByLabel(/Motivo del internamiento/).fill('Seguimiento actualizado')
  await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras).toHaveLength(1); expect(escrituras[0].id).toBe(41)
  expect(escrituras[0].body).toMatchObject({ accion: 'editar', camaId: 11, motivo: 'Seguimiento actualizado', version: '2026-11-01T12:00:00Z' })
})
test('cambiar de Ver a Editar no envía el formulario automáticamente', async ({ page }) => {
  const { modal, escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Ver hospitalización de María de prueba' }).click()
  await modal.getByRole('button', { name: 'Editar ingreso', exact: true }).click()
  await expect(modal.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  expect(escrituras).toHaveLength(0)
  await modal.getByRole('button', { name: 'Volver al detalle' }).click()
  expect(escrituras).toHaveLength(0)
})
test('alta exige nota y confirmación y guarda una sola vez', async ({ page }) => {
  const { modal, escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Ver hospitalización de María de prueba' }).click()
  await modal.getByRole('button', { name: 'Dar de alta', exact: true }).click()
  const guardar = modal.getByRole('button', { name: 'Confirmar alta y liberar cama' })
  await expect(guardar).toBeDisabled()
  await modal.getByLabel(/Nota de egreso/).fill('Nota de prueba y seguimiento')
  await expect(guardar).toBeDisabled()
  await modal.getByRole('checkbox').check()
  await guardar.click()
  await expect(modal).toHaveCount(0)
  expect(escrituras).toHaveLength(1)
  expect(escrituras[0].body).toMatchObject({ accion: 'alta', confirmado: true, notaAlta: 'Nota de prueba y seguimiento' })
})
test('ingreso cerrado advierte y exige motivo de corrección sin reasignar cama', async ({ page }) => {
  const { modal, escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Editar hospitalización de Carlos de prueba' }).click()
  await expect(modal.getByText(/Estás corrigiendo un ingreso cerrado/)).toBeVisible()
  await expect(modal.getByRole('radio')).toHaveCount(0)
  const guardar = modal.getByRole('button', { name: 'Guardar cambios' })
  await expect(guardar).toBeDisabled()
  await modal.getByLabel(/Motivo de la corrección/).fill('Corrección documentada de prueba')
  await guardar.click(); await expect(modal).toHaveCount(0)
  expect(escrituras[0].id).toBe(42); expect(escrituras[0].body.camaId).toBe(12)
})
test('filtros de listado y mapa permiten iniciar admisión con cama seleccionada', async ({ page }) => {
  const { modal } = await preparar(page)
  await page.getByRole('searchbox', { name: 'Buscar hospitalización' }).fill('MARIA')
  await expect(page.getByRole('button', { name: 'Ver hospitalización de Carlos de prueba' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Mapa de camas' }).click()
  await page.getByRole('button', { name: 'Asignar cama', exact: true }).first().click()
  await expect(modal.getByRole('heading', { name: 'Nueva admisión hospitalaria' })).toBeVisible()
  await expect(modal.getByRole('radio', { name: /Cama B/ })).toBeChecked()
  await expect(modal.getByRole('option', { name: 'María de prueba', exact: true })).toHaveCount(0)
  await expect(modal.getByRole('button', { name: 'Registrar ingreso', exact: true })).toBeDisabled()
})
test('admisión funciona en móvil con pie visible y desplazamiento interno', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await preparar(page)
  await page.getByRole('button', { name: 'Nueva admisión', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('heading', { name: 'Nueva admisión hospitalaria' })).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Cancelar', exact: true })).toBeInViewport()
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana + 1)
})

test('registra un nuevo ingreso con paciente, médico y cama elegidos', async ({ page }) => {
  const { modal, escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Nueva admisión', exact: true }).click()
  await modal.getByLabel('Paciente a internar', { exact: true }).selectOption('8')
  await modal.getByLabel('Médico responsable', { exact: true }).selectOption('3')
  await modal.getByRole('radio', { name: /Cama B/ }).check()
  await modal.getByLabel(/Motivo del internamiento/).fill('Ingreso de prueba')
  await modal.getByRole('button', { name: 'Registrar ingreso', exact: true }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras).toHaveLength(1)
  expect(escrituras[0].body).toMatchObject({ pacienteId: 8, medicoId: 3, camaId: 11, motivo: 'Ingreso de prueba' })
})
test('conflicto al guardar conserva el borrador y comunica el error', async ({ page }) => {
  const { modal, escrituras } = await preparar(page)
  await page.route('**/api/internacion/41', async (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 409, json: { error: 'El ingreso cambió. Vuelve a abrirlo antes de guardar.' } })
    return route.fallback()
  })
  await page.getByRole('button', { name: 'Editar hospitalización de María de prueba' }).click()
  await modal.getByLabel(/Motivo del internamiento/).fill('Borrador conservado')
  await modal.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(modal.getByRole('alert')).toContainText('El ingreso cambió')
  await expect(modal.getByLabel(/Motivo del internamiento/)).toHaveValue('Borrador conservado')
  expect(escrituras).toHaveLength(0)
})
test('exporta censo filtrado a PDF y CSV', async ({ page }) => {
  await preparar(page)
  await page.getByRole('searchbox', { name: 'Buscar hospitalización' }).fill('MARIA')
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Censo PDF', exact: true }).click()])
  await expect(popup.locator('tbody tr')).toHaveCount(1)
  await expect(popup.locator('tbody')).toContainText('María de prueba')
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar CSV', exact: true }).click()])
  expect(descarga.suggestedFilename()).toBe('internacion_camas.csv')
})
