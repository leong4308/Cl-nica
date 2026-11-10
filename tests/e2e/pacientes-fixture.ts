import type { Page } from '@playwright/test'

export async function simularDirectorioPacientes(page: Page, pacientes: object[] | (() => object[])) {
  await page.route('**/api/pacientes', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ json: { pacientes: typeof pacientes === 'function' ? pacientes() : pacientes } })
  })
}
