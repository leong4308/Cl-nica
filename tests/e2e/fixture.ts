import { test as base } from '@playwright/test'
export * from '@playwright/test'

// La campana está presente en todos los roles. Ninguna prueba simulada debe
// enviar sus cookies ficticias al servidor Auth ni abrir WebSockets reales.
export const test = base.extend<{ aislarNotificaciones: void }>({
  aislarNotificaciones: [async ({ page }, use) => {
    await page.route('**/rest/v1/rpc/clinica_consulta_leer',r=>r.fulfill({json:{version:'a'.repeat(32),nota:null}}))
    await page.route('**/api/medico**',r=>{const params=new URL(r.request().url()).searchParams;return r.fulfill({json:r.request().method()==='POST'?{ok:true,mensaje:'Consulta guardada.'}:params.has('cita')?{cita:{id:Number(params.get('cita')),pacienteId:1,paciente:'Paciente de prueba',medico:'Médico de prueba',cedula:'PRUEBA',inicio:'2026-11-12T18:00:00Z',estado:'pendiente',motivo:'Consulta',alertas:null},version:'a'.repeat(32),puedeEditar:true,nota:null,correcciones:[],ordenes:[],catalogo:[]}:{dia:params.get('dia'),ahora:'2026-11-12T18:00:00Z',citas:[],abiertas:[],resultados:[],incidencias:[]}})})
    await page.route('**/api/recepcion**', r => { const params = new URL(r.request().url()).searchParams; return r.fulfill({ json: params.has('cita') ? { id: Number(params.get('cita')), estado: 'confirmada', puedeIniciar: false, version: 'a'.repeat(32), llegada: null, enConsulta: null } : { dia: params.get('dia') ?? '2026-11-12', ahora: '2026-11-12T18:00:00Z', citas: [], medicos: [] } }) })
    await page.route('**/api/notificaciones/correo', r => r.fulfill({ json: { paciente: false, activo: true, configurado: true, verificado: true } }))
    await page.route('**/api/pacientes/*/portal', r => r.fulfill({ json: { correo: 'paciente@example.test', activa: false, invitada: false, configurado: false } }))
    await page.route('**/api/gestion/**', r => r.fulfill({ json: { pacientes: [], medicos: [], clinicas: [], salas: [], turnos: [], solicitudes: [], ofertas: [], controles: [], citas: [], envios: [], porDia: [], porMedico: [], trabajadorActivo: false, ahora: new Date().toISOString() } }))
    await page.route('**/api/admin/camas', r => r.fulfill({ json: { clinicas: [], habitaciones: [], camas: [] } }))
    await page.route('**/api/enfermeria', r => r.fulfill({ json: { rol:'enfermero',usuarioId:1,enfermeroId:1,servidorAhora:new Date().toISOString(),pacientes:[],enfermeros:[],turnos:[],tareas:[],registros:[],citas:[],ingresos:[],ordenes:[],muestras:[],movimientos:[],camas:[] } }))
    await page.route('**/api/sesion', async r => {
      const t = new Date().toISOString()
      return r.fulfill({ json: { id: '11111111-1111-4111-8111-111111111112', usuarioId: '11111111-1111-4111-8111-111111111111', correo: 'cuenta@example.test', nombre: 'Cuenta de prueba', bloqueada: false, ultimaActividad: t, servidorAhora: t } })
    })
    await page.route('**/api/citas/respuestas', r => r.fulfill({ json: { solicitudes: [] } }))
    await page.route('**/api/notificaciones', r => r.fulfill({ json: { notificaciones: [], sinLeer: 0 } }))
    await page.route('**/api/notificaciones/telegram', r => r.fulfill({ json: { configurado: false, conectado: false, nombre: null, pendiente: null } }))
    await page.route('**/api/portal-paciente', r => r.fulfill({ json: { perfil: { id: 1, nombre: 'Paciente de prueba', correo: 'paciente@example.test', telefono: null, fecha_nacimiento: null, contacto_emergencia: null, telefono_emergencia: null }, citas: [], resultados: [], consultas: [] } }))
    await page.routeWebSocket(/\/realtime\/v1\//, ws => ws.close())
    await use()
  }, { auto: true }],
})
