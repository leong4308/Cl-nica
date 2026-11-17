import { simularDirectorioPacientes } from './pacientes-fixture'
import { test, expect, type Page } from './fixture'

async function preparar(page: Page, rol = 'enfermero', vacio = false) {
  await simularDirectorioPacientes(page, [])
  await page.context().grantPermissions(['local-network-access'])
  await page.clock.setFixedTime(new Date('2026-11-11T18:00:00Z'))
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'cuenta@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const token = `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.prueba`
  await page.route('**/auth/v1/**', r => r.fulfill({ json: r.request().url().endsWith('/user') ? user : { user, access_token: token, refresh_token: 'simulado', expires_in: 3600, token_type: 'bearer' } }))
  await page.route('**/rest/v1/**', r => r.fulfill({ json: new URL(r.request().url()).pathname.endsWith('/usuarios') ? [{ id: 5, auth_user_id: user.id, nombre_completo: 'Personal de prueba', rol, esta_activo: true }] : [] }))
  const datos = {
    resumenCamas: { total: 6, ocupadas: 2, libres: 4 }, mapaCamas: [{ id: 1, numero: 'A', habitacion: '101', tipo: 'General', clinica_id: 1, esta_ocupada: true, habilitada: true, habitacion_activa: true }, { id: 2, numero: 'B', habitacion: '101', tipo: 'General', clinica_id: 1, esta_ocupada: false, habilitada: true, habitacion_activa: true }],
    rol, usuarioId: 5, enfermeroId: rol === 'enfermero' ? 1 : null, servidorAhora: '2026-11-11T18:00:00Z',
    pacientes: vacio ? [] : [{ id: 1, nombre: 'Paciente asignado de prueba', telefono: '5551234567', contacto: 'Familiar', telefono_emergencia: '5557654321', alertas: '{"alergias":"Registradas en su ficha"}' }],
    enfermeros: [{ id: 1, nombre: 'Enfermero de prueba', clinica_id: 1 }, { id: 2, nombre: 'Relevo de prueba', clinica_id: 1 }],
    turnos: vacio ? [] : [{ id: 1, paciente_id: 1, enfermero_id: 1, enfermero: 'Enfermero de prueba', inicio: '2026-11-11T14:00:00Z', fin: '2026-11-11T22:00:00Z', area: 'Hospitalización' }, { id: 2, paciente_id: 1, enfermero_id: 2, enfermero: 'Relevo de prueba', inicio: '2026-11-11T22:00:00Z', fin: '2026-11-12T06:00:00Z', area: 'Hospitalización' }],
    tareas: [{ id: 10, paciente_id: 1, tipo: 'medicamento', titulo: 'Dosis autorizada de prueba', datos: { dosis: 'Según prescripción', via: 'Vía indicada', texto: 'Indicación registrada por el médico' }, programada: '2026-11-11T17:00:00Z', estado: 'pendiente', vigente: true }],
    registros: [{ id: 20, paciente_id: 1, tipo: 'nota', datos: { texto: 'Cuidados y evolución documentados' }, autor: 5, responsable: 'Enfermero de prueba', creado_en: '2026-11-11T17:00:00Z', observado_en: '2026-11-11T17:00:00Z', corrige_id: null, destinatario: null, respuesta: null, confirmado_en: null, recibido_por: null }],
    citas: [{ id: 35, paciente_id: 1, inicio: '2026-11-11T18:20:00Z', fin: '2026-11-11T18:40:00Z', estado: 'confirmada', motivo: 'Seguimiento', medico: 'Médico de prueba' }],
    ingresos: [{ id: 30, paciente_id: 1, version: '2026-11-11T14:00:00Z', clinica_id: 1, estado: 'activa', cama: 'A', habitacion: '101', medico: 'Médico de prueba' }],
    ordenes: [{ id: 40, paciente_id: 1, tipo_orden: 'medicamento', descripcion: 'Prescripción del médico', instrucciones: 'Instrucciones originales', estado: 'prescrita', version: 'a'.repeat(32) }],
    muestras: [{ id: 50, paciente_id: 1, estudio: 'Estudio pendiente de prueba', estado_analisis: 'solicitado', fecha_toma_muestra: null, con_documento: false }],
    movimientos: [{ id: 60, paciente_id: 1, tipo: 'alta', indicacion: 'Autorización de prueba del médico', medico: 'Médico de prueba' }], camas: [],
  }
  const escrituras: { accion: string; datos: Record<string, unknown>; clave: string }[] = []
  await page.route('**/api/enfermeria', async r => {
    if (r.request().method() === 'POST') { escrituras.push(r.request().postDataJSON()); return r.fulfill({ json: { id: 100, mensaje: 'Registro guardado con fecha y responsable.' } }) }
    return r.fulfill({ json: datos })
  })
  await page.goto('/')
  await page.locator('input[type=email]').fill(user.email)
  await page.locator('input[type=password]').fill('ClaveSimulada123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  if (rol === 'medico') { await expect(page.getByRole('heading', { name: 'Citas médicas', exact: true })).toBeVisible(); return { datos, escrituras } }
  if (rol !== 'enfermero') await page.getByRole('button', { name: 'Enfermería', exact: true }).click()
  await expect(page.getByRole('heading', { name: rol === 'enfermero' ? 'Hola, Personal de prueba' : 'Seguimiento de enfermería' })).toBeVisible()
  return { datos, escrituras }
}

test('sin asignación muestra un turno vacío y no ofrece el directorio ni prescripciones', async ({ page }) => {
  await preparar(page, 'enfermero', true)
  await expect(page.getByText('No tienes pacientes asignados', { exact: false })).toBeVisible()
  for (const nombre of ['Registrar paciente', 'Nueva orden', 'Registrar resultado', 'Nueva admisión']) await expect(page.getByRole('button', { name: nombre, exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tomar signos', exact: true })).toBeDisabled()
})

test('registra signos desde el paciente asignado sin sobrescribir la ficha', async ({ page }) => {
  const { escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Tomar signos', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Registrar signos vitales' })
  await modal.getByLabel('Frecuencia cardiaca', { exact: true }).fill('72')
  await modal.getByLabel('Temperatura', { exact: true }).fill('36.5')
  await modal.getByRole('button', { name: 'Guardar registro' }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras[0]).toMatchObject({ accion: 'signos', datos: { pacienteId: 1, valores: { pulso: 72, temperatura: 36.5 } } })
  expect(escrituras[0].datos).not.toHaveProperty('autor')
})

test('la administración de medicamentos muestra la indicación sin campos para modificarla y exige confirmación', async ({ page }) => {
  const { escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Órdenes médicas', exact: true }).click()
  await page.getByRole('button', { name: 'Registrar administración', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Registrar administración' })
  await expect(modal.getByText('Según prescripción', { exact: true })).toBeVisible()
  await expect(modal.getByLabel('Dosis indicada por el médico', { exact: true })).toHaveCount(0)
  await modal.getByRole('button', { name: 'Guardar registro' }).click()
  expect(escrituras).toHaveLength(0)
  await modal.getByRole('checkbox', { name: /Verifiqué la identidad/ }).check()
  await modal.getByRole('button', { name: 'Guardar registro' }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras).toHaveLength(1)
  expect(escrituras[0]).toMatchObject({ accion: 'cumplir', datos: { tareaId: 10, pacienteId: 1, confirmado: true } })
})

test('enfermería registra muestras y llegadas sin validar resultados ni marcar la consulta como atendida', async ({ page }) => {
  const { escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Laboratorio', exact: true }).click()
  await expect(page.getByRole('button', { name: /Modificar resultados|Registrar resultado/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Registrar toma', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar registro' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(escrituras[0]).toMatchObject({ accion: 'muestra', datos: { solicitudId: 50, etapa: 'tomada' } })
  await page.getByRole('button', { name: 'Citas', exact: true }).click()
  await page.getByRole('button', { name: 'Registrar llegada', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar registro' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(escrituras[1]).toMatchObject({ accion: 'llegada', datos: { citaId: 35 } })
  expect(escrituras[1].datos).not.toHaveProperty('estado')
})

test('la salida requiere la autorización del médico y una nota de enfermería', async ({ page }) => {
  const { escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Internación', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Dar de alta', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Completar salida', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Completar salida del paciente' })
  await expect(modal.getByText('Autorización de prueba del médico')).toBeVisible()
  await modal.getByLabel('Nota de enfermería de la salida o traslado').fill('Salida documentada')
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Guardar registro' }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras[0]).toMatchObject({ accion: 'movimiento', datos: { autorizacionId: 60, confirmado: true } })
})

test('administración asigna paciente y turno, sin poder programar una dosis médica', async ({ page }) => {
  const { escrituras } = await preparar(page, 'admin')
  await page.getByRole('button', { name: 'Asignar turno', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Asignar paciente a un turno' })
  await modal.getByLabel('Paciente', { exact: true }).selectOption('1')
  await modal.getByLabel('Enfermero', { exact: true }).selectOption('1')
  await modal.getByLabel('Área de atención').fill('Hospitalización')
  await modal.getByRole('button', { name: 'Guardar registro' }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras[0]).toMatchObject({ accion: 'asignar', datos: { pacienteId: 1, enfermeroId: 1, area: 'Hospitalización' } })
  await page.getByRole('navigation', { name: 'Secciones de enfermería', exact: true }).getByRole('button', { name: 'Pacientes', exact: true }).click()
  await page.getByRole('button', { name: 'Programar atención', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('option', { name: 'Dosis de medicamento' })).toHaveCount(0)
})

test('el médico no muestra el módulo de enfermería ni sus formularios de programación', async ({ page }) => {
  const { escrituras } = await preparar(page, 'medico')
  await expect(page.getByRole('button', { name: 'Enfermería', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Programar atención', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Seguimiento de enfermería', exact: true })).toHaveCount(0)
  expect(escrituras).toHaveLength(0)
})

test('administración muestra todos los enfermeros en tarjetas y asigna desde la persona seleccionada', async ({ page }) => {
  const { datos, escrituras } = await preparar(page, 'admin')
  datos.enfermeros.push({ id: 3, nombre: 'Enfermero sin asignaciones', clinica_id: 1 })
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click()
  const tarjetas = page.getByLabel('Enfermeros y asignaciones', { exact: true })
  await expect(tarjetas.getByRole('article')).toHaveCount(3)
  await expect(tarjetas.getByRole('article', { name: 'Enfermero Enfermero de prueba', exact: true })).toContainText('Con pacientes asignados ahora')
  const libre = tarjetas.getByRole('article', { name: 'Enfermero Enfermero sin asignaciones', exact: true })
  await expect(libre).toContainText('Sin asignación vigente')
  await expect(libre).toContainText('Sin turnos asignados en los próximos siete días.')
  const relevo = tarjetas.getByRole('article', { name: 'Enfermero Relevo de prueba', exact: true })
  await relevo.getByRole('button', { name: 'Consultar asignaciones', exact: true }).click()
  const detalle = page.getByRole('region', { name: 'Asignaciones del personal de enfermería', exact: true })
  await expect(detalle.getByRole('combobox', { name: 'Filtrar enfermero', exact: true })).toHaveValue('2')
  await expect(detalle.getByRole('row').filter({ hasText: 'Paciente asignado de prueba' })).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await relevo.getByRole('button', { name: 'Asignar paciente', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Asignar paciente a un turno', exact: true })
  await expect(modal.getByRole('combobox', { name: 'Enfermero', exact: true })).toHaveValue('2')
  await expect(modal.getByRole('combobox', { name: 'Paciente', exact: true })).toHaveValue('')
  await modal.getByRole('combobox', { name: 'Paciente', exact: true }).selectOption('1')
  await modal.getByLabel('Área de atención', { exact: true }).fill('Hospitalización')
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras[0]).toMatchObject({ accion: 'asignar', datos: { enfermeroId: 2, pacienteId: 1 } })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: '.herramientas/agenda-enfermeros-admin.png', fullPage: true })
  await detalle.getByRole('button', { name: 'Ver seguimiento', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible()
  expect(escrituras).toHaveLength(1)
})

test('una nota en móvil conserva el borrador ante error', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click()
  await page.getByRole('complementary').getByRole('button', { name: 'Pacientes', exact: true }).click()
  await page.getByRole('button', { name: 'Añadir nota', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Nueva nota de enfermería' })
  await modal.getByLabel('Valoración, cuidados y respuesta del paciente').fill('Cuidados del turno documentados')
  await page.route('**/api/enfermeria', r => r.request().method() === 'POST' ? r.fulfill({ status: 409, json: { error: 'El turno cambió. Revisa tu asignación.' } }) : r.fallback())
  await modal.getByRole('button', { name: 'Guardar registro' }).click()
  await expect(modal.getByRole('alert')).toContainText('El turno cambió')
  await expect(modal.getByLabel('Valoración, cuidados y respuesta del paciente')).toHaveValue('Cuidados del turno documentados')
  expect(await modal.evaluate(e => e.scrollWidth > e.clientWidth)).toBe(false)
  await expect(modal.getByRole('button', { name: 'Cancelar' })).toBeInViewport()
  expect(escrituras).toHaveLength(0)
})

test('la entrega de turno se dirige al relevo que tiene asignado el paciente', async ({ page }) => {
  const { escrituras } = await preparar(page)
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click()
  await page.getByRole('button', { name: 'Preparar entrega de turno' }).click()
  const modal = page.getByRole('dialog', { name: 'Entregar turno del paciente' })
  await modal.getByLabel('Enfermero que recibe', { exact: true }).selectOption('2')
  await modal.getByLabel('Situación actual, cuidados realizados y pendientes').fill('Pendientes y evolución documentados para el relevo')
  await modal.getByRole('button', { name: 'Guardar registro' }).click()
  await expect(modal).toHaveCount(0)
  expect(escrituras[0]).toMatchObject({ accion: 'entrega', datos: { pacienteId: 1, destinatario: 2 } })
})
