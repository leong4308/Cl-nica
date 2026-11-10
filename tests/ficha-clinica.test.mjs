import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function cargar(ruta, dependencias = {}) {
  const source = readFileSync(new URL(ruta, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require', 'exports', js)((id) => id === '@/lib/pacientes/acceso' ? { autorizarRegistro: async () => null } : id === '@/lib/supabase/error-operacion' ? cargar('../lib/supabase/error-operacion.ts') : dependencias[id] ?? require(id), exports)
  return exports
}
const ficha = cargar('../lib/pacientes/ficha-clinica.ts')
const original = { alergias: 'Alergia registrada', tipoSangre: 'A+', condicionesCronicas: 'Antecedente registrado', medicamentoActual: 'Tratamiento registrado', signosVitales: { presionArterial: '110/70', frecuenciaCardiaca: '70', tomadoPor: 'Registro anterior', fechaHora: '2026-10-01T12:00:00Z' } }
const raw = JSON.stringify(original)

test('editar alertas conserva los signos y su autor y fecha originales', () => {
  const nueva = ficha.actualizarFichaClinica(raw, { alergias: 'Actualizada', tipoSangre: 'O+' }, 'alertas', 'Médica actual', '2026-11-09T12:00:00Z')
  assert.equal(nueva.alergias, 'Actualizada')
  assert.equal(nueva.tipoSangre, 'O+')
  assert.equal(nueva.medicamentoActual, original.medicamentoActual)
  assert.deepEqual(nueva.signosVitales, original.signosVitales)
})
test('editar signos conserva las alertas y usa la identidad del servidor', () => {
  const nueva = ficha.actualizarFichaClinica(raw, { signosVitales: { frecuenciaCardiaca: '75', tomadoPor: 'Autor falso', fechaHora: 'fecha falsa' } }, 'signos', 'Médica verificada', '2026-11-09T12:00:00Z')
  assert.equal(nueva.alergias, original.alergias)
  assert.equal(nueva.signosVitales.presionArterial, '110/70')
  assert.equal(nueva.signosVitales.frecuenciaCardiaca, '75')
  assert.equal(nueva.signosVitales.tomadoPor, 'Médica verificada')
  assert.equal(nueva.signosVitales.fechaHora, '2026-11-09T12:00:00Z')
})
test('guardar valores sin cambios conserva la fecha y autor anteriores', () => {
  const nueva = ficha.actualizarFichaClinica(raw, { signosVitales: original.signosVitales }, 'signos', 'Otro autor', 'otra fecha')
  assert.deepEqual(nueva.signosVitales, original.signosVitales)
})
test('permite vaciar una alerta de forma explícita sin borrar las demás', () => {
  const nueva = ficha.actualizarFichaClinica(raw, { alergias: '' }, 'alertas', 'Médica', 'fecha')
  assert.equal(nueva.alergias, undefined)
  assert.equal(nueva.condicionesCronicas, original.condicionesCronicas)
  assert.deepEqual(nueva.signosVitales, original.signosVitales)
})
test('conserva antecedentes antiguos guardados como texto', () => {
  const nueva = ficha.actualizarFichaClinica('Antecedente en texto', { tipoSangre: 'B+' }, 'alertas', 'Médica', 'fecha')
  assert.equal(nueva.condicionesCronicas, 'Antecedente en texto')
  assert.equal(nueva.tipoSangre, 'B+')
})
test('rechaza objetos malformados y valores demasiado largos', () => {
  assert.throws(() => ficha.actualizarFichaClinica(raw, [], 'alertas', 'autor', 'fecha'))
  assert.throws(() => ficha.actualizarFichaClinica(raw, { alergias: { dato: 'incorrecto' } }, 'alertas', 'autor', 'fecha'))
  assert.throws(() => ficha.actualizarFichaClinica(raw, { signosVitales: { peso: 'x'.repeat(41) } }, 'signos', 'autor', 'fecha'))
})

function escenario({ sinSesion = false, rol = 'medico', conflicto = false } = {}) {
  const escrituras = []
  const db = { auth: { getUser: async () => ({ data: { user: sinSesion ? null : { id: 'actual' } } }) }, from(tabla) {
    const query = { select() { return query }, eq() { return query }, async maybeSingle() { return { data: tabla === 'usuarios' ? { rol, esta_activo: true, nombre_completo: 'Médica verificada' } : { id: 7, notas_medicas: raw } } } }
    return query
  } }
  const admin = { from() { const query = { update(valor) { escrituras.push(valor); return query }, eq() { return query }, is() { return query }, select() { return query }, async maybeSingle() { return { data: conflicto ? null : { id: 7 }, error: null } } }; return query } }
  const api = cargar('../app/api/pacientes/ficha-importante/route.ts', { '@/lib/supabase/server': { createClient: async () => db }, '@supabase/supabase-js': { createClient: () => admin }, '@/lib/pacientes/ficha-clinica': ficha })
  const guardar = (seccion = 'alertas') => api.POST(new Request('http://localhost/api/pacientes/ficha-importante', { method: 'POST', body: JSON.stringify({ pacienteId: 7, ficha: { alergias: 'Nueva alergia' }, seccion }) }))
  return { guardar, escrituras }
}
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.test'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'clave-de-prueba'
test('la API devuelve la ficha combinada que se guardó', async () => {
  const e = escenario()
  const res = await e.guardar()
  assert.equal(res.status, 200)
  const guardada = JSON.parse(e.escrituras[0].notas_medicas)
  assert.deepEqual(guardada.signosVitales, original.signosVitales)
  assert.deepEqual((await res.json()).ficha, guardada)
})
test('la API exige autenticación y rol clínico', async () => {
  assert.equal((await escenario({ sinSesion: true }).guardar()).status, 401)
  assert.equal((await escenario({ rol: 'paciente' }).guardar()).status, 403)
})
test('rechaza una sección inválida y detecta un cambio concurrente', async () => {
  const e = escenario()
  assert.equal((await e.guardar('otra')).status, 400)
  assert.deepEqual(e.escrituras, [])
  assert.equal((await escenario({ conflicto: true }).guardar()).status, 409)
})
