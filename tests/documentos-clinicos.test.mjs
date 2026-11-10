import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function cargar(ruta, dependencias = {}) {
  const fuente = readFileSync(new URL(ruta, import.meta.url), 'utf8')
  const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require', 'exports', js)((id) => id === '@/lib/pacientes/acceso' ? { autorizarRegistro: async () => null } : id === '@/lib/supabase/error-operacion' ? cargar('../lib/supabase/error-operacion.ts') : dependencias[id] ?? require(id), exports)
  return exports
}
const pdf = cargar('../lib/laboratorio/archivo-pdf.ts')
const documentos = cargar('../lib/documentos-clinicos.ts', { './laboratorio/archivo-pdf': pdf })
const archivo = () => new File(['%PDF-1.7\nPDF de prueba'], 'informe.pdf', { type: 'application/pdf' })

test('los documentos clínicos permiten hasta 2 MB inclusive y laboratorio conserva su límite', async () => {
  const contenido = new Uint8Array(documentos.LIMITE_PDF_CLINICO)
  contenido.set(new TextEncoder().encode('%PDF-1.7'))
  assert.equal(await documentos.validarDocumentoClinico(new File([contenido], 'exacto.pdf')), null)
  const excedido = new File([contenido, 'a'], 'grande.pdf', { type: 'application/pdf' })
  assert.match(await documentos.validarDocumentoClinico(excedido), /2 MB/)
  assert.equal(await pdf.validarPdf(excedido), null)
  assert.match(await documentos.validarDocumentoClinico(new File(['falso'], 'falso.pdf')), /PDF válido/)
})

function escenario({ tipo = 'expedientes', rol = 'admin', sinSesion = false, inactivo = false, noExiste = false } = {}) {
  const llamadas = { subidas: [], firmas: [], listas: [] }
  const db = { rpc: async () => ({ data: null, error: null }),
    auth: { getUser: async () => ({ data: { user: sinSesion ? null : { id: 'prueba' } }, error: null }) },
    from(tabla) {
      const query = { select() { return query }, eq() { return query }, async maybeSingle() { return { data: tabla === 'usuarios' ? { rol, esta_activo: !inactivo } : noExiste ? null : { id: 1 }, error: null } } }
      return query
    },
  }
  const storage = { from() { return {
    async upload(ruta) { llamadas.subidas.push(ruta); return { error: null } },
    async createSignedUrl(ruta) { llamadas.firmas.push(ruta); return { data: { signedUrl: 'https://example.test/informe.pdf' }, error: null } },
    async list(prefijo) { llamadas.listas.push(prefijo); return { data: [{ name: '12345678-1234-4234-8234-123456789012-informe.pdf' }], error: null } },
  } } }
  const api = cargar('../app/api/documentos-clinicos/[tipo]/[id]/route.ts', {
    '@/lib/supabase/server': { createClient: async () => db },
    '@supabase/supabase-js': { createClient: () => ({ storage }) },
    '@/lib/documentos-clinicos': documentos,
    '@/lib/laboratorio/archivo-pdf': pdf,
  })
  const contexto = { params: Promise.resolve({ tipo, id: '1' }) }
  async function subir(pdfElegido = archivo()) {
    const form = new FormData(); form.set('archivo', pdfElegido)
    return api.POST(new Request('http://localhost/api/documentos-clinicos', { method: 'POST', body: form }), contexto)
  }
  return { api, contexto, llamadas, subir }
}
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.test'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'clave-de-prueba'

test('sin sesión, paciente, perfil inactivo o registro inaccesible no permiten subir PDF', async () => {
  for (const [opciones, status] of [[{ sinSesion: true }, 401], [{ rol: 'paciente' }, 403], [{ inactivo: true }, 403], [{ noExiste: true }, 404], [{ tipo: 'pacientes' }, 400]]) {
    const e = escenario(opciones)
    assert.equal((await e.subir()).status, status)
    assert.deepEqual(e.llamadas.subidas, [])
  }
})
test('enfermería adjunta a órdenes pero no a expedientes', async () => {
  assert.equal((await escenario({ rol: 'enfermero', tipo: 'expedientes' }).subir()).status, 403)
  assert.equal((await escenario({ rol: 'enfermero', tipo: 'ordenes' }).subir()).status, 200)
})
test('servidor rechaza PDF mayor de 2 MB y contenido falso sin subirlos', async () => {
  const e = escenario()
  assert.equal((await e.subir(new File([new Uint8Array(documentos.LIMITE_PDF_CLINICO + 1)], 'grande.pdf'))).status, 400)
  assert.equal((await e.subir(new File(['texto'], 'falso.pdf'))).status, 400)
  assert.deepEqual(e.llamadas.subidas, [])
})
test('el PDF queda en la carpeta del registro y la lista devuelve enlaces privados', async () => {
  const e = escenario()
  assert.equal((await e.subir()).status, 200)
  assert.match(e.llamadas.subidas[0], /^expedientes\/1\/[a-f0-9-]+-informe.pdf$/)
  const res = await e.api.GET(new Request('http://localhost/api/documentos-clinicos/expedientes/1'), e.contexto)
  assert.equal(res.status, 200)
  assert.deepEqual(e.llamadas.listas, ['expedientes/1'])
  const { archivos } = await res.json()
  assert.equal(archivos[0].nombre, 'informe.pdf')
  assert.match(archivos[0].href, /^\/api\/documentos-clinicos\/expedientes\/1\?archivo=/)
  assert.match(res.headers.get('cache-control'), /no-store/)
})
test('abrir no acepta rutas hacia documentos de otro registro', async () => {
  const e = escenario()
  assert.equal((await e.api.GET(new Request('http://localhost?archivo=../2/informe.pdf'), e.contexto)).status, 400)
  assert.deepEqual(e.llamadas.firmas, [])
  const res = await e.api.GET(new Request('http://localhost?archivo=informe.pdf'), e.contexto)
  assert.equal(res.status, 307)
  assert.deepEqual(e.llamadas.firmas, ['expedientes/1/informe.pdf'])
})
