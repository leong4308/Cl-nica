import {test,expect,type Page} from './fixture'
import {simularDirectorioPacientes} from './pacientes-fixture'
async function preparar(page:Page,cerrada=false){
 await simularDirectorioPacientes(page,[]);await page.clock.setFixedTime(new Date('2026-11-12T18:00:00Z'));await page.context().grantPermissions(['local-network-access'])
 const user={id:'11111111-1111-4111-8111-111111111111',email:'medico@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}
 const enc=(v:object)=>Buffer.from(JSON.stringify(v)).toString('base64url'),token=`${enc({alg:'HS256'})}.${enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.prueba`
 await page.route('**/auth/v1/**',r=>r.fulfill({json:r.request().url().endsWith('/user')?user:{user,access_token:token,refresh_token:'simulado',expires_in:3600,token_type:'bearer'}}))
 await page.route('**/rest/v1/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/usuarios')?[{id:2,auth_user_id:user.id,nombre_completo:'Médico de prueba',rol:'medico',esta_activo:true}]:[]}))
 const contenido={subjetivo:'Evolución registrada',objetivo:'Exploración documentada',diagnostico:'Problema clínico registrado',plan:'Plan registrado',pronostico:'',seguimiento:'Control según evolución',recetaLibre:'',medicamentos:[]}
 const ctx={cita:{id:35,pacienteId:1,paciente:'Paciente de prueba',medico:'Médico de prueba',cedula:'CED-1',inicio:'2026-11-12T18:00:00Z',estado:cerrada?'atendida':'confirmada',motivo:'Seguimiento',alertas:null},version:'a'.repeat(32),puedeEditar:true,nota:{id:1,contenido,estado_nota:cerrada?'cerrada':'borrador',diagnostico:contenido.diagnostico,receta:null,notas_doctor:null,cerrada_en:cerrada?'2026-11-12T18:00:00Z':null},correcciones:[] as object[],ordenes:[] as object[],catalogo:[{id:1,nombre:'Estudio de prueba'}]}
 const panel={dia:'2026-11-12',ahora:'2026-11-12T18:00:00Z',citas:[{id:35,pacienteId:1,paciente:'Paciente de prueba',inicio:'2026-11-12T18:00:00Z',fin:'2026-11-12T18:20:00Z',estado:ctx.cita.estado,motivo:'Seguimiento',llegada:'2026-11-12T17:50:00Z',enConsulta:'2026-11-12T17:55:00Z'}],abiertas:[],resultados:[{id:70,paciente:'Paciente de prueba',estudio:'Resultado de prueba',resultado:'Informe disponible',fecha:'2026-11-12T17:00:00Z',version:'b'.repeat(32),conPdf:false}],incidencias:[],puedeValidarLaboratorio:false}
 const escrituras:any[]=[];let fallo=false
 await page.route('**/api/documentos-clinicos/**',r=>r.fulfill({json:{archivos:[]}}))
 await page.route('**/api/medico**',r=>{
  if(r.request().method()==='POST'){const b=r.request().postDataJSON();escrituras.push(b);if(fallo){fallo=false;return r.fulfill({status:503,json:{error:'No se pudo verificar el guardado. Tu borrador se conserva.'}})}
   if(b.accion==='guardar'){ctx.nota.contenido=b.datos.contenido;if(b.datos.cerrar){ctx.nota.estado_nota='cerrada';ctx.nota.cerrada_en='2026-11-12T18:00:00Z';ctx.cita.estado='atendida'}}
   if(b.accion==='corregir')ctx.correcciones.push({id:1,autor:'Médico de prueba',motivo:b.datos.motivo,texto:b.datos.texto,fecha:'2026-11-12T18:00:00Z'})
   if(b.accion==='orden')ctx.ordenes.push({id:80,tipo:b.datos.tipo,descripcion:b.datos.descripcion,instrucciones:b.datos.instrucciones,estado:'prescrita'})
   if(b.accion==='revisar')panel.resultados=[]
   return r.fulfill({json:{ok:true,mensaje:'Atención registrada correctamente.'}})
  }
  return r.fulfill({json:new URL(r.request().url()).searchParams.has('cita')?ctx:panel})
 })
 await page.goto('/');await page.locator('input[type=email]').fill(user.email);await page.locator('input[type=password]').fill('ClaveSimulada123*');await page.getByRole('button',{name:'Ingresar',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Citas médicas',exact:true})).toBeVisible()
 return {ctx,panel,escrituras,fallar:()=>{fallo=true}}
}
test('consulta estructurada finaliza con confirmación y emite receta desde la nota cerrada',async({page})=>{
 const {escrituras}=await preparar(page)
 await page.getByRole('button',{name:'Abrir consulta',exact:true}).click()
 const modal=page.getByRole('dialog')
 await modal.getByLabel('Plan de tratamiento e indicaciones').fill('Plan actualizado por el médico')
 await page.screenshot({path:'.herramientas/medico-consulta.png',fullPage:true})
 await expect(modal.getByRole('button',{name:'Receta PDF',exact:true})).toHaveCount(0)
 await modal.getByRole('button',{name:'Finalizar consulta',exact:true}).click();expect(escrituras).toHaveLength(0)
 await modal.getByRole('button',{name:'Confirmar cierre de consulta',exact:true}).click()
 await expect(modal.getByText('Cita #35 · Nota cerrada')).toBeVisible()
 expect(escrituras[0]).toMatchObject({accion:'guardar',datos:{citaId:35,cerrar:true,contenido:{plan:'Plan actualizado por el médico'}}})
 await expect(modal.getByLabel('Diagnóstico o problema clínico')).toBeDisabled()
 const popup=page.waitForEvent('popup');await modal.getByRole('button',{name:'Receta PDF',exact:true}).click();await expect((await popup).getByText('Prescripción vinculada a la consulta #35')).toBeVisible()
})
test('un fallo temporal conserva el borrador y reintentar usa el mismo identificador',async({page})=>{
 const {escrituras,fallar}=await preparar(page);await page.getByRole('button',{name:'Abrir consulta',exact:true}).click()
 const modal=page.getByRole('dialog');await modal.getByLabel('Exploración y hallazgos').fill('Hallazgos que deben conservarse');fallar()
 await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click()
 await expect(modal.getByRole('alert')).toContainText('Tu borrador se conserva')
 await expect(modal.getByLabel('Exploración y hallazgos')).toHaveValue('Hallazgos que deben conservarse')
 await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();await expect(modal.getByRole('status')).toContainText('Atención registrada')
 expect(escrituras[0].clave).toBe(escrituras[1].clave)
})
test('una aclaración conserva la nota cerrada y registra motivo y autor',async({page})=>{
 const {ctx,escrituras}=await preparar(page,true);await page.getByRole('button',{name:'Ver nota cerrada',exact:true}).click()
 const modal=page.getByRole('dialog');await modal.getByRole('button',{name:'Aclaraciones',exact:true}).click()
 await modal.getByLabel('Motivo de la aclaración').fill('Aclarar el seguimiento');await modal.getByLabel('Texto de la aclaración').fill('Información adicional documentada por el médico')
 await modal.getByRole('button',{name:'Añadir aclaración',exact:true}).click();await expect(modal.getByText('Información adicional documentada por el médico',{exact:true})).toBeVisible()
 expect(ctx.nota.diagnostico).toBe('Problema clínico registrado');expect(escrituras[0].accion).toBe('corregir')
})
test('emite una orden ambulatoria y no exige un ingreso hospitalario',async({page})=>{
 const {escrituras}=await preparar(page);await page.getByRole('button',{name:'Abrir consulta',exact:true}).click();const modal=page.getByRole('dialog')
 await modal.getByRole('button',{name:'Órdenes ambulatorias',exact:true}).click();await modal.getByRole('combobox',{name:'Estudio',exact:true}).selectOption('1');await modal.getByLabel('Indicaciones',{exact:true}).fill('Indicaciones registradas por el prescriptor')
 await modal.getByRole('button',{name:'Emitir orden',exact:true}).click();await expect(modal.getByText('Orden #80 · prescrita')).toBeVisible()
 expect(escrituras[0]).toMatchObject({accion:'orden',datos:{citaId:35,analisisId:1,tipo:'analisis'}})
})
test('revisión de resultados y diseño móvil sin validación de laboratorio automática',async({page})=>{
 await page.setViewportSize({width:390,height:844});const {escrituras}=await preparar(page)
 await page.getByRole('button',{name:'Registrar revisión',exact:true}).click();await page.getByLabel('Comentario clínico de revisión').fill('Resultado revisado para seguimiento')
 await page.getByRole('button',{name:'Confirmar revisión',exact:true}).click();await expect(page.getByText('No hay resultados nuevos pendientes de revisar.')).toBeVisible()
 expect(escrituras[0]).toMatchObject({accion:'revisar',datos:{resultadoId:70}})
 await expect(page.getByRole('button',{name:'Mi Consulta',exact:true})).toHaveCount(0)
 const ancho=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,pantalla:innerWidth}));expect(ancho.doc).toBeLessThanOrEqual(ancho.pantalla+1)
 await page.screenshot({path:'.herramientas/medico-movil.png',fullPage:true})
})
