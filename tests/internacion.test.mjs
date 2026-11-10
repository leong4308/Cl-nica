import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function cargar(ruta, deps = {}) {
  const js = ts.transpileModule(readFileSync(new URL(ruta, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}; new Function('require', 'exports', js)((id) => id === '@/lib/pacientes/acceso' ? { autorizarRegistro: async () => null } : id === '@/lib/supabase/error-operacion' ? cargar('../lib/supabase/error-operacion.ts') : deps[id] ?? require(id), exports); return exports
}
const modelo = cargar('../lib/internacion/modelo.ts')
const servidor = cargar('../lib/internacion/servidor.ts', { './modelo': modelo, '@/lib/cuenta/servidor': {} })
const ops = cargar('../lib/internacion/operaciones.ts', { './servidor': servidor, './modelo': modelo })
const actor = { id: 90, nombre_completo: 'Profesional verificado' }
const version = '2026-11-01T12:00:00.000Z'
function escenario(opciones = {}) {
  const tablas = {
    internaciones: opciones.vacio ? [] : [{ id: 1, paciente_id: 7, medico_responsable_id: 3, cama_id: 10, habitacion_id: 100, clinica_id: 1, estado: 'activa', actualizado_en: version, motivo_ingreso: 'Motivo anterior', diagnostico_ingreso: 'Diagnóstico anterior', habitaciones: { numero: 'Habitación 100' }, camas: { numero: 'Cama A' } }],
    camas: [{ id: 10, habitacion_id: 100, numero: 'Cama A', esta_ocupada: !opciones.vacio, habitaciones: { numero: 'Habitación 100', clinica_id: 1 } }, { id: 11, habitacion_id: 101, numero: 'Cama B', esta_ocupada: false, habitaciones: { numero: 'Habitación 101', clinica_id: 1 } }],
    perfiles_pacientes: [{ id: 7, esta_activo: true, usuarios: { esta_activo: true } }],
    perfiles_medicos: [{ id: 3, esta_activo: true, clinica_id: 1, usuarios: { esta_activo: true } }], episodios_medicos: [],
  }
  const escrituras = []
  const db = { from(tabla) {
    let accion = 'select', valores, condiciones = []
    const q = {
      select() { return q }, eq(k, v) { condiciones.push([k, v]); return q }, limit() { return q }, order() { return q },
      update(v) { accion = 'update'; valores = v; return q }, insert(v) { accion = 'insert'; valores = v; return q }, delete() { accion = 'delete'; return q },
      single() { return ejecutar(true) }, maybeSingle() { return ejecutar(true) }, then(ok, err) { return ejecutar(false).then(ok, err) },
    }
    async function ejecutar(single) {
      if (opciones.fallarEvento && tabla === 'episodios_medicos' && accion === 'insert') return { data: null, error: { message: 'fallo simulado' } }
      let filas = tablas[tabla].filter((f) => condiciones.every(([k, v]) => f[k] === v))
      if (accion !== 'select') escrituras.push({ tabla, accion, valores, condiciones })
      if (accion === 'insert') { const nuevo = { id: 50 + tablas[tabla].length, actualizado_en: version, ...valores }; tablas[tabla].push(nuevo); filas = [nuevo] }
      if (accion === 'update') {
        if (opciones.conflicto && tabla === 'internaciones') filas = []
        filas.forEach((f) => Object.assign(f, valores))
      }
      if (accion === 'delete') tablas[tabla] = tablas[tabla].filter((f) => !filas.includes(f))
      return { data: single ? (filas[0] ? structuredClone(filas[0]) : null) : structuredClone(filas), error: null }
    }
    return q
  } }
  const anterior = structuredClone(tablas.internaciones[0])
  const editar = (extra = {}) => ({ accion: 'editar', version, medicoId: 3, camaId: 10, motivo: 'Motivo actualizado', diagnostico: 'Diagnóstico actualizado', ...extra })
  return { db, tablas, escrituras, anterior, editar }
}
test('normaliza ubicación sin duplicar Habitación ni Cama', () => {
  assert.equal(modelo.ubicacionHospital('Habitación 103', 'Cama 103-A'), 'Habitación 103 · Cama 103-A')
  assert.equal(modelo.diasHospital('2026-11-01T12:00:00Z', '2026-11-02T12:00:00Z'), 1)
  assert.throws(() => servidor.idHospital('no-id'))
})
test('ingreso reserva cama y registra evento con autor validado', async () => {
  const e = escenario({ vacio: true }); const res = await ops.crearIngreso(e.db, { pacienteId: 7, medicoId: 3, camaId: 10, motivo: 'Observación' }, actor)
  assert.equal(res.id, 50); assert.equal(e.tablas.camas[0].esta_ocupada, true)
  assert.equal(e.tablas.episodios_medicos[0].tipo_episodio, 'Ingreso')
  assert.equal(e.tablas.episodios_medicos[0].otros_signos.auditoria.nombre, actor.nombre_completo)
})
test('rechaza otro ingreso del mismo paciente sin escribir', async () => {
  const e = escenario(); await assert.rejects(ops.crearIngreso(e.db, { pacienteId: 7, medicoId: 3, camaId: 11, motivo: 'Observación' }, actor), /ya tiene/); assert.equal(e.escrituras.length, 0)
})
test('reserva condicional impide ocupar una cama no disponible', async () => {
  const e = escenario({ vacio: true }); e.tablas.camas[0].esta_ocupada = true
  await assert.rejects(servidor.reservarCama(e.db, 10), /dejó de estar disponible/)
  assert.equal(e.tablas.internaciones.length, 0)
})
test('si falla el evento de ingreso revierte ingreso y libera la reserva', async () => {
  const e = escenario({ vacio: true, fallarEvento: true })
  await assert.rejects(ops.crearIngreso(e.db, { pacienteId: 7, medicoId: 3, camaId: 10, motivo: 'Observación' }, actor), /movimiento/)
  assert.equal(e.tablas.internaciones.length, 0); assert.equal(e.tablas.camas[0].esta_ocupada, false)
})
test('traslado reserva nueva cama, conserva ingreso y libera anterior', async () => {
  const e = escenario(); await ops.modificarIngreso(e.db, e.anterior, e.editar({ camaId: 11, notaCambio: 'Cambio de ubicación' }), actor)
  assert.equal(e.tablas.internaciones[0].estado, 'activa'); assert.equal(e.tablas.internaciones[0].cama_id, 11)
  assert.equal(e.tablas.camas[0].esta_ocupada, false); assert.equal(e.tablas.camas[1].esta_ocupada, true)
  assert.match(e.tablas.episodios_medicos[0].descripcion, /Habitación 100 · Cama A a Habitación 101 · Cama B/)
  assert.match(e.tablas.episodios_medicos[0].descripcion, /Motivo anterior/)
})
test('conflicto de edición revierte evento y reserva de cama', async () => {
  const e = escenario({ conflicto: true }); await assert.rejects(ops.modificarIngreso(e.db, e.anterior, e.editar({ camaId: 11 }), actor), /cambió durante/)
  assert.equal(e.tablas.episodios_medicos.length, 0); assert.equal(e.tablas.camas[1].esta_ocupada, false); assert.equal(e.tablas.camas[0].esta_ocupada, true)
})
test('versión antigua se rechaza antes de escribir', async () => {
  const e = escenario(); await assert.rejects(ops.modificarIngreso(e.db, e.anterior, e.editar({ version: 'anterior' }), actor), /cambió/); assert.equal(e.escrituras.length, 0)
})
test('alta exige confirmación y nota, registra egreso y libera cama', async () => {
  const e = escenario(); const alta = { accion: 'alta', version }
  await assert.rejects(ops.modificarIngreso(e.db, e.anterior, alta, actor), /Confirma/)
  await assert.rejects(ops.modificarIngreso(e.db, e.anterior, { ...alta, confirmado: true }, actor), /nota de egreso/)
  await ops.modificarIngreso(e.db, e.anterior, { ...alta, confirmado: true, notaAlta: 'Seguimiento registrado' }, actor)
  assert.equal(e.tablas.internaciones[0].estado, 'alta'); assert.ok(e.tablas.internaciones[0].fecha_alta); assert.equal(e.tablas.camas[0].esta_ocupada, false)
  assert.equal(e.tablas.episodios_medicos[0].tipo_episodio, 'Alta')
  await assert.rejects(ops.modificarIngreso(e.db, e.tablas.internaciones[0], { ...alta, version: e.tablas.internaciones[0].actualizado_en, confirmado: true, notaAlta: 'Repetida' }, actor), /ya está cerrado/)
})
test('corregir ingreso cerrado exige razón y no puede reasignar cama', async () => {
  const e = escenario(); e.anterior.estado = 'alta'; e.tablas.internaciones[0].estado = 'alta'; e.tablas.camas[0].esta_ocupada = false
  await assert.rejects(ops.modificarIngreso(e.db, e.anterior, e.editar(), actor), /nota del cambio/)
  await assert.rejects(ops.modificarIngreso(e.db, e.anterior, e.editar({ camaId: 11, notaCambio: 'Corrección' }), actor), /No se puede reasignar/)
  await ops.modificarIngreso(e.db, e.anterior, e.editar({ notaCambio: 'Corrección documentada' }), actor)
  assert.equal(e.tablas.camas[0].esta_ocupada, false); assert.equal(e.tablas.internaciones[0].estado, 'alta'); assert.equal(e.tablas.episodios_medicos[0].tipo_episodio, 'Corrección de registro')
})
test('no libera una cama vinculada a otro ingreso activo', async () => {
  const e = escenario(); assert.equal(await servidor.liberarCama(e.db, 10), false); assert.equal(e.escrituras.length, 0)
})
test('cola serializa operaciones concurrentes sin bloquearse después de un error', async () => {
  const orden = []
  await Promise.allSettled([servidor.operarHospital(async () => { orden.push('inicio'); await new Promise((r) => setTimeout(r, 10)); orden.push('fin'); throw Error('simulado') }), servidor.operarHospital(async () => orden.push('segunda'))])
  assert.deepEqual(orden, ['inicio', 'fin', 'segunda'])
})
test('API rechaza sesiones ausentes y roles ajenos a hospitalización', async () => {
  for (const status of [401, 403]) {
    const api = cargar('../app/api/internacion/route.ts', { '@/lib/internacion/servidor': { ...servidor, accesoHospital: async () => ({ respuesta: Response.json({ error: 'Sin permiso' }, { status }) }) }, '@/lib/internacion/operaciones': ops, '@/lib/cuenta/servidor': { origenValido: () => true } })
    assert.equal((await api.GET()).status, status)
    assert.equal((await api.POST(new Request('http://localhost/api/internacion', { method: 'POST', body: '{}' }))).status, status)
  }
})
test('rechaza IDs ambiguos y datos de otra clínica antes de reservar', async () => {
  for (const id of [true, null, {}, '1e1', '1.5', -1, 0]) assert.throws(() => servidor.idHospital(id))
  const e = escenario({ vacio: true }); e.tablas.perfiles_medicos[0].clinica_id = 2
  await assert.rejects(ops.crearIngreso(e.db, { pacienteId: 7, medicoId: 3, camaId: 10, motivo: 'Observación' }, actor), /misma clínica/)
  assert.equal(e.escrituras.length, 0)
})
test('control de acceso valida roles clínicos y propaga sesión ausente', async () => {
  const respuesta = Response.json({ error: 'Sin sesión' }, { status: 401 })
  let cuenta = { respuesta }
  const api = cargar('../lib/internacion/servidor.ts', { './modelo': modelo, '@/lib/cuenta/servidor': { cuentaAutenticada: async () => cuenta } })
  assert.equal((await api.accesoHospital()).respuesta.status, 401)
  for (const rol of ['paciente', 'recepcionista']) {
    cuenta = { db: {}, usuario: { rol, esta_activo: true } }
    assert.equal((await api.accesoHospital()).respuesta.status, 403)
  }
})
test('PDF escapa texto clínico antes de incluirlo en HTML y reconoce bloqueo de ventana', () => {
  const exportar = cargar('../lib/exportar/exportar-internacion.ts')
  const ventanaAnterior = globalThis.window
  let html = ''; const ventana = { opener: 'padre', document: { write: (v) => { html = v }, close() {} } }
  try {
    globalThis.window = { open: () => ventana }
    assert.equal(exportar.exportarInternacionPDF([{ ubicacion: 'Cama A', paciente: '<img src=x onerror=alert(1)>', medico: 'A & B', ingreso: '2026', estado: 'Alta' }]), true)
    assert.ok(!html.includes('<img src=x')); assert.match(html, /&lt;img/); assert.match(html, /A &amp; B/); assert.equal(ventana.opener, null)
    globalThis.window.open = () => null; assert.equal(exportar.exportarInternacionPDF([]), false)
  } finally { globalThis.window = ventanaAnterior }
})
