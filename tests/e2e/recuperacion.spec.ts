import { test, expect } from '@playwright/test'
test('el login solicita un enlace real de recuperación y muestra una respuesta neutra',async({page})=>{
  let correo=''
  await page.route('**/auth/v1/**',r=>r.fulfill({json:{user:null}}))
  await page.route('**/api/accesos-prueba',r=>r.fulfill({json:{habilitado:false}}))
  await page.route('**/auth/v1/recover*',r=>{correo=r.request().postDataJSON().email;return r.fulfill({json:{}})})
  await page.goto('/')
  await page.getByRole('button',{name:'¿Olvidaste tu contraseña?',exact:true}).click()
  const modal=page.getByRole('dialog',{name:'Recuperar contraseña'})
  await modal.getByLabel('Correo de la cuenta').fill('recuperar@example.test')
  await modal.getByRole('button',{name:'Enviar enlace de recuperación'}).click()
  await expect(modal.getByRole('status')).toContainText('Si existe una cuenta')
  expect(correo).toBe('recuperar@example.test')
})
test('un enlace válido permite elegir contraseña con confirmación y volver al login',async({page})=>{
  const cambios:any[]=[]
  await page.route('**/api/auth/restablecer',r=>{if(r.request().method()==='POST'){cambios.push(r.request().postDataJSON());return r.fulfill({json:{ok:true}})}return r.fulfill({json:{valido:true}})})
  await page.goto('/restablecer-contrasena')
  await page.getByLabel('Nueva contraseña',{exact:true}).fill('NuevaClave123*')
  await page.getByLabel('Confirmar contraseña').fill('OtraClave123*')
  await page.getByRole('button',{name:'Guardar nueva contraseña'}).click()
  await expect(page.getByRole('alert').filter({hasText:'Las contraseñas no coinciden.'})).toBeVisible()
  expect(cambios).toHaveLength(0)
  await page.getByLabel('Confirmar contraseña').fill('NuevaClave123*')
  await page.getByRole('button',{name:'Guardar nueva contraseña'}).click()
  await expect(page.getByRole('status')).toContainText('Tu contraseña se actualizó')
  expect(cambios).toEqual([{nueva:'NuevaClave123*',confirmacion:'NuevaClave123*'}])
})
test('un enlace expirado no muestra el formulario para cambiar la contraseña',async({page})=>{
  await page.route('**/api/auth/restablecer',r=>r.fulfill({json:{valido:false}}))
  await page.goto('/restablecer-contrasena?error=enlace')
  await expect(page.getByRole('alert').filter({hasText:'El enlace es inválido o expiró.'})).toBeVisible()
  await expect(page.getByLabel('Nueva contraseña',{exact:true})).toHaveCount(0)
})
