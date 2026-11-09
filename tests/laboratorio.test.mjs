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
  new Function('require', 'exports', js)((id) => dependencias[id] ?? require(id), exports)
  return exports
}
const pdf = cargar('../lib/laboratorio/archivo-pdf.ts')
const archivo = () => new File(['%PDF-1.7\nPDF de prueba'], 'reporte.pdf', { type: 'application/pdf' })

test('PDF: acepta PDF y rechaza extensiones, contenido y tamaños inválidos', async () => {
  assert.equal(await pdf.validarPdf(archivo()), null)
  assert.match(await pdf.validarPdf(new File(['%PDF-1.7'], 'reporte.exe')), /archivo PDF/)
  assert.match(await pdf.validarPdf(new File(['texto'], 'falso.pdf', { type: 'application/pdf' })), /PDF válido/)
  assert.match(await pdf.validarPdf(new File([], 'vacio.pdf')), /vacío/)
  assert.match(await pdf.validarPdf(new File([new Uint8Array(pdf.MAX_PDF_BYTES + 1)], 'grande.pdf')), /10 MB/)
})

function escenario(opciones = {}) {
  const registro = { id: 15, archivo_resultado: '15/anterior.pdf', estado_analisis: 'completado', fecha_resultado: '2026-11-09T12:00:00+00:00', ...opciones.registro }
  const llamadas = { actualizaciones: [], subidas: [], eliminados: [], firmas: [] }
  const db = {
    auth: { getUser: async () => ({ data: { user: opciones.sinSesion ? null : { id: 'usuario-prueba' } }, error: null }) },
    from(tabla) {
      let cambios
      const query = {
        select() { return query }, eq() { return query }, is() { return query },
        update(valor) { cambios = valor; llamadas.actualizaciones.push(valor); return query },
        async maybeSingle() {
          if (tabla === 'usuarios') return { data: { rol: opciones.rol ?? 'admin', esta_activo: !opciones.inactivo }, error: null }
          if (cambios) return { data: opciones.sinPermisoActualizar ? null : { id: 15 }, error: null }
          return { data: opciones.noExiste ? null : registro, error: null }
        },
      }
      return query
    },
  }
  const storage = {
    getBucket: async () => ({ data: { public: false }, error: null }),
    from() {
      return {
        async upload(ruta) { llamadas.subidas.push(ruta); return { error: opciones.fallaSubida ? { message: 'fallo' } : null } },
        async remove(rutas) { llamadas.eliminados.push(...rutas); return { error: null } },
        async createSignedUrl(ruta) { llamadas.firmas.push(ruta); return { data: { signedUrl: 'https://example.test/privado.pdf' }, error: null } },
      }
    },
  }
  const api = cargar('../app/api/laboratorio/[id]/route.ts', {
    '@/lib/supabase/server': { createClient: async () => db },
    '@supabase/supabase-js': { createClient: () => ({ storage }) },
    '@/lib/laboratorio/archivo-pdf': pdf,
  })
  const contexto = { params: Promise.resolve({ id: '15' }) }
  async function guardar(campos = {}, nuevoPdf) {
    const form = new FormData()
    for (const [key, value] of Object.entries({ resultado: 'Resultado modificado', observaciones: 'Observación', estado: 'completado', confirmarCompletado: 'true', version: registro.fecha_resultado ?? '', ...campos })) form.set(key, value)
    if (nuevoPdf) form.set('archivo', nuevoPdf)
    return api.POST(new Request('http://localhost/api/laboratorio/15', { method: 'POST', body: form }), contexto)
  }
  return { api, guardar, contexto, llamadas }
}

// La ruta exige configuración incluso con el cliente de almacenamiento simulado.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.test'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'clave-simulada-para-pruebas'

test('no permite ver ni guardar sin sesión', async () => {
  const e = escenario({ sinSesion: true })
  assert.equal((await e.guardar()).status, 401)
  assert.equal((await e.api.GET(new Request('http://localhost'), e.contexto)).status, 401)
  assert.equal(e.llamadas.actualizaciones.length, 0)
})
test('no permite guardar como paciente', async () => {
  const e = escenario({ rol: 'paciente' })
  assert.equal((await e.guardar()).status, 403)
  assert.equal(e.llamadas.actualizaciones.length, 0)
  assert.equal((await e.api.GET(new Request('http://localhost'), e.contexto)).status, 403)
  const inactivo = escenario({ inactivo: true })
  assert.equal((await inactivo.guardar()).status, 403)
})
test('exige confirmar cambios en completados y detecta una versión antigua', async () => {
  const e = escenario()
  assert.equal((await e.guardar({ confirmarCompletado: 'false' })).status, 400)
  assert.equal((await e.guardar({ version: 'version-antigua' })).status, 409)
  assert.equal(e.llamadas.actualizaciones.length, 0)
})
test('editar texto conserva el PDF existente', async () => {
  const e = escenario()
  assert.equal((await e.guardar()).status, 200)
  assert.equal('archivo_resultado' in e.llamadas.actualizaciones[0], false)
  assert.deepEqual(e.llamadas.eliminados, [])
})
test('el reemplazo sube el PDF nuevo, actualiza la referencia y después elimina el anterior', async () => {
  const e = escenario()
  assert.equal((await e.guardar({}, archivo())).status, 200)
  assert.match(e.llamadas.subidas[0], /^15\/.+reporte.pdf$/)
  assert.equal(e.llamadas.actualizaciones[0].archivo_resultado, e.llamadas.subidas[0])
  assert.deepEqual(e.llamadas.eliminados, ['15/anterior.pdf'])
})
test('si falla la actualización elimina solo el PDF nuevo y conserva el anterior', async () => {
  const e = escenario({ sinPermisoActualizar: true })
  assert.equal((await e.guardar({}, archivo())).status, 409)
  assert.deepEqual(e.llamadas.eliminados, e.llamadas.subidas)
  assert.equal(e.llamadas.eliminados.includes('15/anterior.pdf'), false)
})
test('si falla la subida no modifica el resultado', async () => {
  const e = escenario({ fallaSubida: true })
  assert.equal((await e.guardar({}, archivo())).status, 500)
  assert.deepEqual(e.llamadas.actualizaciones, [])
})
test('permite registrar únicamente un PDF y rechaza un resultado totalmente vacío', async () => {
  const e = escenario({ registro: { archivo_resultado: null, estado_analisis: 'solicitado', fecha_resultado: null } })
  assert.equal((await e.guardar({ resultado: '' })).status, 400)
  assert.equal((await e.guardar({ resultado: '' }, archivo())).status, 200)
  assert.equal(e.llamadas.actualizaciones[0].resultado, null)
})
test('abre únicamente el PDF vinculado a una solicitud accesible', async () => {
  const e = escenario()
  const respuesta = await e.api.GET(new Request('http://localhost'), e.contexto)
  assert.equal(respuesta.status, 307)
  assert.match(respuesta.headers.get('cache-control'), /no-store/)
  assert.deepEqual(e.llamadas.firmas, ['15/anterior.pdf'])
  const noExiste = escenario({ noExiste: true })
  assert.equal((await noExiste.api.GET(new Request('http://localhost'), noExiste.contexto)).status, 404)
  const ajeno = escenario({ registro: { archivo_resultado: '13/otro.pdf' } })
  assert.equal((await ajeno.api.GET(new Request('http://localhost'), ajeno.contexto)).status, 404)
})
