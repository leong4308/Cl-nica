import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { correoAviso, entregarCorreos } from '../lib/notificaciones/correo.mjs'
import { procesarOfertaEspera, entregarPendientes } from '../lib/notificaciones/trabajador.mjs'
const require = createRequire(import.meta.url)
function cargar(ruta, deps = {}) {
  const js = ts.transpileModule(readFileSync(new URL(ruta, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}; new Function('require', 'exports', js)(id => deps[id] ?? require(id), exports); return exports
}
const modelo = cargar('../lib/gestion/modelo.ts'), clave = '11111111-1111-4111-8111-111111111111'
test('validación por rol, límites, fechas y proyección de campos de gestión', () => {
  assert.deepEqual(modelo.datosGestion('espera', 'aceptar', { ofertaId: clave, autor: 999 }, 'paciente'), { ofertaId: clave })
  assert.throws(() => modelo.datosGestion('consultorios', 'sala', {}, 'recepcionista'), /rol/)
  assert.throws(() => modelo.datosGestion('controles', 'crear', {}, 'paciente'), /rol/)
  assert.throws(() => modelo.datosGestion('envios', 'reintentar', { id: 1, canal: 'sms' }, 'admin'), /Canal/)
  assert.throws(() => modelo.datosGestion('espera', 'inscribir', { medicoId: 1, desde: '2026-02-30' }, 'paciente'), /Fecha/)
  assert.throws(() => modelo.datosGestion('controles', 'crear', { diasAviso: 31 }, 'medico'), /30 días/)
  assert.throws(() => modelo.datosGestion('espera', 'aceptar', { ofertaId: 'otra' }, 'paciente'), /Oferta/)
})
test('API de gestión exige sesión, origen y rol antes de llamar RPC; nunca acepta actor enviado', async () => {
  let rol = 'paciente', origen = true, bloqueada = false; const llamadas = []
  const api = cargar('../app/api/gestion/[modulo]/route.ts', {
    '@/lib/cuenta/servidor': { cuentaAutenticada: async () => bloqueada ? { respuesta: Response.json({}, { status: 423 }) } : { usuario: { rol }, db: { rpc: async (nombre, p) => { llamadas.push({ nombre, p }); return { data: { mensaje: 'Guardado' } } } } }, origenValido: () => origen },
    '@/lib/gestion/modelo': modelo, '@/lib/supabase/error-operacion': cargar('../lib/supabase/error-operacion.ts'), '@/lib/notificaciones/correo.mjs': { configuracionCorreo: () => null },
  })
  const contexto = modulo => ({ params: Promise.resolve({ modulo }) }), post = (modulo, datos) => api.POST(new Request('https://example.test/api/gestion/' + modulo, { method: 'POST', body: JSON.stringify(datos) }), contexto(modulo))
  bloqueada = true; assert.equal((await api.GET(new Request('https://example.test'), contexto('espera'))).status, 423); bloqueada = false
  assert.equal((await api.GET(new Request('https://example.test'), contexto('envios'))).status, 403)
  origen = false; assert.equal((await post('espera', {})).status, 403); origen = true
  assert.equal((await post('espera', { accion: 'aceptar', clave, datos: { ofertaId: clave, actor: 999 } })).status, 200)
  assert.deepEqual(llamadas[0], { nombre: 'clinica_operar_modulo', p: { p_modulo: 'espera', p_accion: 'aceptar', p_datos: { ofertaId: clave }, p_clave: clave } })
  rol = 'recepcionista'; assert.equal((await api.GET(new Request('https://example.test'), contexto('reportes'))).status, 403)
  assert.equal((await post('consultorios', { accion: 'sala', clave, datos: { clinicaId: 1, nombre: 'Sala' } })).status, 400)
  assert.equal(llamadas.length, 1)
})
test('correos de espera y seguimiento tienen plantilla segura sin requerir una cita', async () => {
  const e = { tipo: 'seguimiento', titulo: 'Control <b>', mensaje: '<script>Revisa tu cuenta</script>', correo: 'paciente@example.test', cita: null }
  assert.ok(correoAviso(e, 'https://example.test').html.includes('&lt;script&gt;'))
  assert.ok(!correoAviso(e, 'https://example.test').html.includes('<script>'))
  const operaciones = [], db = { correo: async (op, d) => { operaciones.push({ op, d }); return op === 'reclamar' ? [{ id: 1, arrendamiento: clave }] : op === 'vigente' ? e : {} } }
  assert.equal(await entregarCorreos(db, { clave: 'privada', remitente: 'prueba@example.test', appUrl: 'https://example.test' }, async (_, opciones) => { assert.ok(JSON.parse(opciones.body).html.includes('Abrir mi cuenta')); return Response.json({ id: 'proveedor' }) }), 1)
  assert.equal(operaciones.at(-1).op, 'enviado')
})
test('ofertas Telegram se responden solo en chat privado; conflictos no cambian citas ni revelan errores internos', async () => {
  const operaciones = [], envios = [], update = { callback_query: { id: 'callback', data: `espera:a:${clave}`, from: { id: 606 }, message: { chat: { id: 606, type: 'private' } } } }
  const db = { operar: async (op, datos) => { operaciones.push({ op, datos }); if (datos[2] === 'aceptar') throw Object.assign(Error('SQL secreto'), { code: '23P01' }); return { rows: [{ r: { mensaje: 'Rechazada' } }] } } }
  const fetcher = async (_, op) => { envios.push(JSON.parse(op.body)); return Response.json({ ok: true, result: {} }) }
  assert.equal(await procesarOfertaEspera(db, 'token', { callback_query: { ...update.callback_query, from: { id: 999 } } }, fetcher), true); assert.equal(operaciones.length, 0)
  await procesarOfertaEspera(db, 'token', update, fetcher)
  assert.deepEqual(operaciones[0], { op: 'respuestaEspera', datos: [606, clave, 'aceptar'] })
  assert.ok(envios.at(-1).text.includes('Tus citas se conservan')); assert.ok(!JSON.stringify(envios).includes('secreto'))
})
test('Telegram presenta botones de oferta sin crear tokens de confirmación de otras citas', async () => {
  const enviados = [], operaciones = [], db = { operar: async op => { operaciones.push(op); return { rows: op === 'reclamar' ? [{ envio_id: 1, reserva: clave, chat_id: 606, titulo: 'Turno libre', mensaje: 'Responde para reservar' }] : op === 'envioVigente' ? [{ usuario_id: 6, tipo: 'espera_oferta', ofertaId: clave, cita: null }] : [] } } }
  assert.equal(await entregarPendientes(db, 'token', async (_, op) => { enviados.push(JSON.parse(op.body)); return Response.json({ ok: true, result: {} }) }), 1)
  assert.equal(enviados[0].reply_markup.inline_keyboard[0][0].callback_data, `espera:a:${clave}`)
  assert.ok(!operaciones.includes('crearAccion'))
})
