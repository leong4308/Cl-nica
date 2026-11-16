import { test, expect, type Page } from './fixture'

async function preparar(page: Page, rol = 'medico') {
  await page.context().grantPermissions(['local-network-access'])
  await page.addInitScript(() => {
    const w = window as any
    w.tonosNotificacion = 0
    class AudioSimulado {
      state = 'suspended'; currentTime = 0; destination = {}
      resume() { this.state = 'running'; return Promise.resolve() }
      close() { this.state = 'closed'; return Promise.resolve() }
      createOscillator() { return { frequency: { value: 0 }, connect() {}, disconnect() {}, start() { w.tonosNotificacion++ }, stop() {}, onended: null } }
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
    }
    w.AudioContext = AudioSimulado
  })
  const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'avisos@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const jwt = `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.prueba`
  await page.route('**/auth/v1/**', r => r.fulfill({ json: r.request().url().endsWith('/user') ? user : { access_token: jwt, refresh_token: 'simulado', expires_in: 3600, token_type: 'bearer', user } }))
  await page.route('**/rest/v1/**', r => {
    const tabla = new URL(r.request().url()).pathname.split('/').pop()
    return r.fulfill({ json: tabla === 'usuarios' ? [{ id: 1, auth_user_id: user.id, nombre_completo: 'Doctora Prueba', rol, esta_activo: true }] : tabla === 'perfiles_medicos' ? [{ id: 1, clinica_id: 1, especialidad: 'General', duracion_consulta: 20 }] : [], headers: { 'content-range': '0-0/0' } })
  })
  const avisos = [{ id: 100, tipo: 'cita_nueva', titulo: 'Nueva cita', mensaje: 'Paciente de prueba. Cita del 12/11/2026 a las 10:00.', cita_id: null, creado_en: '2026-11-10T15:00:00Z', leida_en: null as string | null }]
  const acciones: any[] = []
  await page.route('**/api/notificaciones', async r => {
    if (r.request().method() === 'PATCH') {
      const b = r.request().postDataJSON(); acciones.push(b)
      for (const n of avisos) if (b.id === n.id || (b.todas && n.id <= b.hasta)) n.leida_en = new Date().toISOString()
      return r.fulfill({ json: { ok: true } })
    }
    return r.fulfill({ json: { notificaciones: [...avisos].sort((a, b) => b.id - a.id), sinLeer: avisos.filter(n => !n.leida_en).length } })
  })
  const telegram = { configurado: true, conectado: false, nombre: null as string | null, pendiente: null as { id: string; nombre: string } | null }
  await page.route('**/api/notificaciones/telegram', async r => {
    if (r.request().method() === 'POST') {
      const b = r.request().postDataJSON(); acciones.push(b)
      if (b.accion === 'vincular') return r.fulfill({ json: { enlace: 'https://t.me/clinica_prueba_bot?start=' + 'a'.repeat(43) } })
      if (b.accion === 'confirmar') { telegram.conectado = true; telegram.nombre = telegram.pendiente!.nombre; telegram.pendiente = null }
      if (b.accion === 'desvincular') { telegram.conectado = false; telegram.nombre = null; telegram.pendiente = null }
      return r.fulfill({ json: { ok: true } })
    }
    return r.fulfill({ json: telegram })
  })
  await page.goto('/')
  await page.locator('input[type=email]').fill(user.email)
  await page.locator('input[type=password]').fill('ClaveSimulada123*')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Notificaciones', exact: true })).toBeVisible()
  return { avisos, acciones, telegram }
}

test('la campana cuenta avisos reales, marca leídos y suena solo por novedades después de activarlo', async ({ page }) => {
  const { avisos, acciones } = await preparar(page)
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Notificaciones', exact: true })
  await expect(panel.getByText('1 sin leer · Últimos 50 avisos')).toBeVisible()
  expect(await page.evaluate(() => (window as any).tonosNotificacion)).toBe(0)
  await panel.getByRole('button', { name: 'Activar sonido', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).tonosNotificacion)).toBe(2)
  avisos.push({ ...avisos[0], id: 101, titulo: 'Cita confirmada' })
  await page.evaluate(() => window.dispatchEvent(new Event('datos-actualizados')))
  await expect(panel.getByText('2 sin leer · Últimos 50 avisos')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).tonosNotificacion)).toBe(4)
  await panel.getByRole('button', { name: 'Actualizar notificaciones', exact: true }).click()
  await panel.getByRole('button', { name: 'Marcar todas como leídas', exact: true }).click()
  await expect(panel.getByText('0 sin leer · Últimos 50 avisos')).toBeVisible()
  expect(acciones).toContainEqual({ todas: true, hasta: 101 })
  expect(await page.evaluate(() => (window as any).tonosNotificacion)).toBe(4)
  await panel.getByRole('button', { name: 'Silenciar avisos', exact: true }).click()
  avisos.push({ ...avisos[0], id: 102, titulo: 'Nuevo recordatorio', leida_en: null })
  await page.evaluate(() => window.dispatchEvent(new Event('datos-actualizados')))
  await expect(panel.getByText('Nuevo recordatorio', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as any).tonosNotificacion)).toBe(4)
})

test('un paciente vincula su propio Telegram con confirmación y puede detener los avisos', async ({ page }) => {
  const { telegram, acciones } = await preparar(page, 'paciente')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Notificaciones', exact: true })
  await panel.getByRole('button', { name: 'Vincular Telegram', exact: true }).click()
  await expect(panel.getByRole('link', { name: 'Abrir Telegram y pulsar Iniciar' })).toHaveAttribute('href', /https:\/\/t.me\/clinica_prueba_bot\?start=/)
  telegram.pendiente = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Cuenta de prueba' }
  await panel.getByRole('button', { name: 'Actualizar vinculación', exact: true }).click()
  await panel.getByRole('button', { name: 'Confirmar mi Telegram', exact: true }).click()
  await expect(panel.getByText('Vinculado: Cuenta de prueba', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Desvincular Telegram', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Vincular Telegram', exact: true })).toBeVisible()
  expect(acciones.map(a => a.accion)).toEqual(['vincular', 'confirmar', 'desvincular'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
