import { simularDirectorioPacientes } from './pacientes-fixture'
import { test, expect, type Page } from './fixture'

async function preparar(page: Page, rol = 'admin') {
  const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'prueba@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const encode = (valor: object) => Buffer.from(JSON.stringify(valor)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma-prueba`
  let ficha = { alergias: 'Alergia registrada', tipoSangre: 'A+', condicionesCronicas: 'Antecedente registrado', medicamentoActual: 'Tratamiento registrado', signosVitales: { presionArterial: '110/70', frecuenciaCardiaca: '70', tomadoPor: 'Profesional anterior', fechaHora: '2026-10-01T12:00:00Z' } }
  const escrituras: { pacienteId: number; ficha: Partial<typeof ficha>; seccion: string }[] = []
  const paciente = () => ({ id: 7, usuario_id: 70, fecha_nacimiento: '1990-01-01', genero: 'F', esta_activo: true, notas_medicas: JSON.stringify(ficha), usuarios: { nombre_completo: 'Paciente de prueba', correo: 'paciente@example.test', telefono: '5555555555' } })
  await simularDirectorioPacientes(page, () => [paciente()])
  const citas = [
    { id: 21, paciente_id: 7, motivo: 'Control de seguimiento', inicio: '2026-11-05T12:00:00Z', perfiles_medicos: { usuarios: { nombre_completo: 'Dra. Ana de prueba' } } },
    { id: 22, paciente_id: 7, motivo: 'Valoración de cardiología', inicio: '2026-09-03T12:00:00Z', perfiles_medicos: { usuarios: { nombre_completo: 'Dr. Jorge de prueba' } } },
  ]
  const expedientes = [
    { id: 101, cita_id: 21, creado_en: '2026-11-05T12:00:00Z', diagnostico: 'Diagnóstico de seguimiento', receta: 'Tratamiento de seguimiento', notas_doctor: 'Evolución de seguimiento', citas: citas[0] },
    { id: 102, cita_id: 22, creado_en: '2026-09-03T12:00:00Z', diagnostico: 'Revisión cardiológica', receta: 'Tratamiento registrado anteriormente', notas_doctor: 'Notas de la consulta anterior', citas: citas[1] },
  ]
  await page.route('**/auth/v1/**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/user') ? user : { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'refresh-prueba', user } }))
  await page.route('**/rest/v1/**', async (route) => {
    const tabla = new URL(route.request().url()).pathname.split('/').pop()
    let data: object[] = []
    if (tabla === 'usuarios') data = [{ id: 3, auth_user_id: user.id, nombre_completo: 'Profesional de prueba', correo: user.email, rol, esta_activo: true }]
    if (tabla === 'perfiles_pacientes') data = [paciente()]
    if (tabla === 'citas') data = citas
    if (tabla === 'expedientes') data = expedientes
    if (tabla === 'clinica_historial_paciente') data = expedientes.map(e=>({...e,motivo:e.citas.motivo,medico:e.citas.perfiles_medicos.usuarios.nombre_completo}))
    await route.fulfill({ json: data, headers: { 'content-range': `0-${Math.max(data.length - 1, 0)}/${data.length}` } })
  })
  await page.route('**/api/pacientes/ficha-importante', async (route) => {
    const body = route.request().postDataJSON()
    escrituras.push(body)
    ficha = { ...ficha, ...body.ficha }
    await route.fulfill({ json: { ok: true, ficha } })
  })
  await page.goto('/')
  await page.locator('input[type=email]').fill(user.email)
  await page.locator('input[type=password]').fill('ClaveDePrueba123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click()
  const abrir = async () => {
    if (rol === 'recepcionista') await page.getByRole('article').filter({ hasText: 'Paciente de prueba' }).getByRole('button', { name: 'Ver datos', exact: true }).click()
    else await page.getByRole('row').filter({ hasText: 'Paciente de prueba' }).getByRole('button', { name: 'Ver detalle' }).click()
    return page.getByRole('dialog')
  }
  return { modal: await abrir(), abrir, escrituras }
}

test('invitar al portal confirma el correo y muestra el resultado sin crear otra ficha', async ({ page }) => {
  const envios: any[] = []
  await page.route('**/api/pacientes/7/portal', r => {
    if (r.request().method() === 'POST') { envios.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true, mensaje: 'El servicio de correo aceptó la invitación.' } }) }
    return r.fulfill({ json: { correo: 'paciente@example.test', activa: false, invitada: envios.length > 0, enviada: envios.length ? new Date().toISOString() : null, configurado: true } })
  })
  const { modal, escrituras } = await preparar(page)
  const panel = modal.getByRole('region', { name: 'Acceso al portal del paciente' })
  await expect(panel.getByRole('button', { name: 'Invitar al portal' })).toBeDisabled()
  await panel.getByRole('checkbox').check()
  await panel.getByRole('button', { name: 'Invitar al portal' }).click()
  await expect(panel.getByRole('status')).toContainText('aceptó la invitación')
  await expect(panel.getByRole('button', { name: 'Reenviar invitación' })).toBeDisabled()
  expect(envios).toEqual([{ confirmarCorreo: true }]); expect(escrituras).toHaveLength(0)
})

test('una ficha con cuenta vinculada ofrece recuperar el acceso y evita nuevas invitaciones', async ({ page }) => {
  await page.route('**/api/pacientes/7/portal', r => r.fulfill({ json: { correo: 'paciente@example.test', activa: true, configurado: true } }))
  const { modal } = await preparar(page)
  await expect(modal.getByText(/Cuenta vinculada/)).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Invitar al portal' })).toHaveCount(0)
})

test('recepción invita desde los datos administrativos sin entrar al historial clínico', async ({ page }) => {
  await page.route('**/api/pacientes/7/portal', r => r.fulfill({ json: { correo: 'paciente@example.test', activa: false, configurado: true } }))
  const { modal } = await preparar(page, 'recepcionista')
  await expect(modal.getByRole('button', { name: 'Invitar al portal' })).toBeVisible()
  await expect(modal.getByRole('tab', { name: 'Historial clínico' })).toHaveCount(0)
})

for (const rol of ['admin', 'recepcionista']) test(`${rol}: edita el correo de una ficha sin cuenta desde Guardar cambios`, async ({ page }) => {
  const cambios: any[] = []
  await page.route('**/api/pacientes/7', r => {
    if (r.request().method() === 'PATCH') { cambios.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true, correoActual: 'nuevo@example.test' } }) }
    return r.fulfill({ json: { puedeEditarCorreo: true, accesoVinculado: false, paciente: { nombre: 'Paciente de prueba', correo: 'paciente@example.test', telefono: '5555555555', fechaNacimiento: '', genero: '', contactoEmergencia: '', telefonoEmergencia: '' } } })
  })
  const { modal } = await preparar(page, rol)
  await modal.getByRole('button', { name: 'Editar información', exact: true }).click()
  const editar = page.getByRole('dialog', { name: 'Editar información del paciente' })
  await expect(editar.getByLabel('Correo de acceso')).toBeEditable()
  await editar.getByLabel('Correo de acceso').fill('nuevo@example.test')
  await editar.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await expect(editar).toHaveCount(0)
  expect(cambios).toHaveLength(1); expect(cambios[0]).toMatchObject({ correo: 'nuevo@example.test', correoAnterior: 'paciente@example.test' })
})

test('un correo de acceso activo queda pendiente sin cerrar el formulario ni reemplazar el actual', async ({ page }) => {
  await page.route('**/api/pacientes/7', r => r.fulfill({ json: r.request().method() === 'PATCH' ? { ok: true, correoActual: 'paciente@example.test', correoPendiente: 'nuevo@example.test', mensaje: 'El paciente debe confirmar el nuevo correo.' } : { puedeEditarCorreo: true, accesoVinculado: true, paciente: { nombre: 'Paciente de prueba', correo: 'paciente@example.test', telefono: '', fechaNacimiento: '', genero: '', contactoEmergencia: '', telefonoEmergencia: '' } } }))
  const { modal } = await preparar(page)
  await modal.getByRole('button', { name: 'Editar información', exact: true }).click()
  const editar = page.getByRole('dialog', { name: 'Editar información del paciente' })
  await editar.getByLabel('Correo de acceso').fill('nuevo@example.test')
  await editar.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await expect(editar.getByText(/Cambio pendiente de confirmación/)).toBeVisible()
  await expect(editar.getByLabel('Correo de acceso')).toHaveValue('paciente@example.test')
})

test('Importante permite editar alertas desde el botón inferior sin modificar signos', async ({ page }) => {
  const { modal, abrir, escrituras } = await preparar(page)
  await modal.getByRole('tab', { name: 'Importante', exact: true }).click()
  await modal.getByRole('button', { name: 'Editar alertas y antecedentes', exact: true }).click()
  await expect(modal.getByLabel('Alergias conocidas')).toHaveValue('Alergia registrada')
  await expect(modal.getByLabel('Nombre completo')).toHaveCount(0)
  expect(escrituras).toHaveLength(0)
  await modal.getByLabel('Alergias conocidas').fill('Alergia modificada')
  await modal.getByLabel('Grupo sanguíneo').selectOption('O+')
  await modal.getByRole('button', { name: 'Guardar alertas', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('guardados correctamente')
  expect(escrituras[0].pacienteId).toBe(7)
  expect(escrituras[0].seccion).toBe('alertas')
  expect(escrituras[0].ficha.signosVitales).toBeUndefined()
  await expect(modal.getByText('Profesional anterior', { exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await abrir()
  await modal.getByRole('tab', { name: 'Importante', exact: true }).click()
  await expect(modal.getByText('Alergia modificada', { exact: true })).toBeVisible()
  await expect(modal.getByText('O+', { exact: true })).toBeVisible()
})

test('signos vitales tiene su propio formulario y cancelar alertas no guarda', async ({ page }) => {
  const { modal, escrituras } = await preparar(page)
  await modal.getByRole('tab', { name: 'Importante', exact: true }).click()
  await modal.getByRole('button', { name: 'Editar alertas', exact: true }).click()
  await modal.getByLabel('Alergias conocidas').fill('Borrador cancelado')
  await modal.getByRole('button', { name: 'Cancelar edición', exact: true }).click()
  expect(escrituras).toHaveLength(0)
  await expect(modal.getByText('Alergia registrada', { exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Actualizar signos vitales', exact: true }).click()
  await expect(modal.getByLabel('Alergias conocidas')).toHaveCount(0)
  await modal.getByLabel(/Frecuencia cardíaca/).fill('75')
  await modal.getByRole('button', { name: 'Guardar signos vitales', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('Signos vitales guardados')
  expect(escrituras[0].seccion).toBe('signos')
  expect(escrituras[0].ficha.alergias).toBeUndefined()
  await expect(modal.getByText('Alergia registrada', { exact: true })).toBeVisible()
})

test('historial organiza consultas, filtra sin acentos y cambia el orden de fechas', async ({ page }) => {
  const { modal } = await preparar(page)
  await modal.getByRole('tab', { name: 'Historial clínico', exact: true }).click()
  await expect(modal.getByRole('heading', { name: 'Seguimiento clínico', exact: true })).toBeVisible()
  await expect(modal.getByRole('article')).toHaveCount(2)
  await expect(modal.getByRole('article').first().getByRole('heading', { name: 'Control de seguimiento' })).toBeVisible()
  await expect(modal.getByText('Evolución de seguimiento', { exact: true })).toBeVisible()
  await modal.getByLabel('Buscar en el historial').fill('CARDIOLOGIA')
  await expect(modal.getByRole('article')).toHaveCount(1)
  await expect(modal.getByRole('article').first().getByRole('heading', { name: 'Valoración de cardiología' })).toBeVisible()
  await modal.getByLabel('Médico tratante', { exact: true }).selectOption('Dra. Ana de prueba')
  await expect(modal.getByText('No encontramos consultas con esos filtros', { exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Limpiar filtros', exact: true }).click()
  await modal.getByLabel('Orden de consultas').selectOption('antiguos')
  await expect(modal.getByRole('article').first().getByRole('heading', { name: 'Valoración de cardiología' })).toBeVisible()
  await modal.getByRole('article').first().getByRole('button', { name: 'Ver tratamiento y notas', exact: true }).click()
  await expect(modal.getByText('Notas de la consulta anterior', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await modal.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth)).toBe(false)
})
