import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de extremo a extremo contra la app real (Next.js en producción).
 * Requieren un build previo: `pnpm build`.
 *
 *   pnpm test:e2e
 *
 * Levanta el servidor él mismo en el puerto 3210 y usa las cuentas de prueba
 * que ya existen en Supabase (ver components/login/login-form.tsx).
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3210',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start --port 3210',
    url: 'http://127.0.0.1:3210',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})