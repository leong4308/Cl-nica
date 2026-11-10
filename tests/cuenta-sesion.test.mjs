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
const preferencias = cargar('../lib/cuenta/preferencias.ts')
const validacion = cargar('../lib/cuenta/validacion.ts')
const navegacion = cargar('../components/modulos/barra-lateral/navegacion/items-menu.ts')

test('Mi Consulta es exclusiva de administración y el médico inicia en Citas', () => {
  for (const rol of ['admin', 'medico', 'enfermero', 'recepcionista', 'paciente']) {
    assert.equal(navegacion.obtenerNavItemsPorRol(rol).some((item) => item.label === 'Mi Consulta'), rol === 'admin')
  }
  assert.equal(navegacion.obtenerItemDefaultPorRol('medico'), 'Citas')
})

test('preferencias no permiten abrir páginas ajenas al rol', () => {
  assert.equal(preferencias.normalizarPreferencias({ paginaInicio: 'Mi Consulta' }, 'recepcionista').paginaInicio, 'Predeterminada')
  assert.equal(preferencias.normalizarPreferencias({ paginaInicio: 'Mi Consulta' }, 'medico').paginaInicio, 'Predeterminada')
  assert.equal(preferencias.normalizarPreferencias({ paginaInicio: 'Mi Consulta' }, 'admin').paginaInicio, 'Mi Consulta')
  assert.equal(preferencias.normalizarPreferencias({ textoGrande: 'true' }, 'admin').textoGrande, false)
})
test('valida teléfonos, nombres y fechas de nacimiento reales', () => {
  assert.equal(validacion.validarNombreTelefono('Ana', '+52 555 555 5555'), null)
  assert.match(validacion.validarNombreTelefono('', ''), /nombre/)
  assert.match(validacion.validarNombreTelefono('Ana', 'telefono'), /teléfono/)
  assert.equal(validacion.validarNacimiento('2000-02-29'), true)
  assert.equal(validacion.validarNacimiento('2001-02-29'), false)
  assert.equal(validacion.validarNacimiento('2999-01-01'), false)
})
test('el perfil de sesión se obtiene del usuario autenticado y del rol de la base', async () => {
  const filtros = []
  const query = { select() { return query }, eq(campo, valor) { filtros.push([campo, valor]); return query }, async maybeSingle() { return { data: { id: 1, nombre_completo: 'Ana', rol: 'recepcionista', esta_activo: true } } } }
  const sesion = cargar('../lib/supabase/sesion.ts', { './client': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'id-verificado', user_metadata: { rol: 'admin' } } } }) }, from: () => query }) }, '@/lib/cuenta/preferencias': preferencias })
  const perfil = await sesion.cargarPerfilSesion()
  assert.equal(perfil.rol, 'recepcionista')
  assert.deepEqual(filtros, [['auth_user_id', 'id-verificado']])
})
test('no restaura una sesión inexistente', async () => {
  const sesion = cargar('../lib/supabase/sesion.ts', { './client': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }, '@/lib/cuenta/preferencias': preferencias })
  await assert.rejects(sesion.cargarPerfilSesion(), /sesión activa/)
})

function cuenta(opciones = {}) {
  const escrituras = []
  const db = {
    from() {
      const query = { update(payload) { escrituras.push(payload); return query }, eq() { return query }, select() { return query }, async maybeSingle() { return { data: { id: 1 }, error: null } } }
      return query
    },
    auth: { updateUser: async (datos) => { escrituras.push(datos); return { error: opciones.requiereCodigo ? { code: 'reauthentication_needed' } : null } } },
  }
  const servidor = { origenValido: () => true, cuentaAutenticada: async () => ({ db, user: { id: 'id-actual', email: 'actual@example.test' }, usuario: { id: 1, rol: 'medico', esta_activo: true } }) }
  return { db, servidor, escrituras }
}
test('mi perfil actualiza solo nombre y teléfono de la cuenta autenticada', async () => {
  const e = cuenta()
  const api = cargar('../app/api/cuenta/route.ts', { '@/lib/cuenta/servidor': e.servidor, '@/lib/cuenta/preferencias': preferencias, '@/lib/cuenta/validacion': validacion })
  const respuesta = await api.PATCH(new Request('http://localhost/api/cuenta', { method: 'PATCH', body: JSON.stringify({ accion: 'perfil', nombre: 'Ana', telefono: '5555555555', id: 999, rol: 'admin', correo: 'otro@example.test' }) }))
  assert.equal(respuesta.status, 200)
  assert.deepEqual(e.escrituras, [{ nombre_completo: 'Ana', telefono: '5555555555' }])
})
test('preferencias guarda únicamente opciones normalizadas', async () => {
  const e = cuenta()
  const api = cargar('../app/api/cuenta/route.ts', { '@/lib/cuenta/servidor': e.servidor, '@/lib/cuenta/preferencias': preferencias, '@/lib/cuenta/validacion': validacion })
  const res = await api.PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ accion: 'preferencias', preferencias: { altoContraste: true, rol: 'admin', paginaInicio: 'Usuarios' } }) }))
  assert.equal(res.status, 200)
  assert.deepEqual(e.escrituras[0], { data: { clinica_preferencias: { textoGrande: false, reducirAnimaciones: false, altoContraste: true, paginaInicio: 'Predeterminada' } } })
})
for (const correcto of [false, true]) {
  test(`contraseña actual ${correcto ? 'correcta permite el cambio' : 'incorrecta impide el cambio'}`, async () => {
    const e = cuenta()
    let verificacion
    let cierres = 0
    const api = cargar('../app/api/cuenta/contrasena/route.ts', {
      '@/lib/cuenta/servidor': e.servidor,
      '@supabase/supabase-js': { createClient: () => ({ auth: { signInWithPassword: async (credenciales) => { verificacion = credenciales; return { data: { user: correcto ? { id: 'id-actual' } : null }, error: correcto ? null : { status: 400 } } }, signOut: async () => { cierres++; return { error: null } } } }) },
    })
    const res = await api.POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ actual: 'Anterior123*', nueva: 'NuevaClave123*', confirmacion: 'NuevaClave123*', email: 'atacante@example.test' }) }))
    assert.equal(res.status, correcto ? 200 : 400)
    assert.equal(verificacion.email, 'actual@example.test')
    assert.equal(e.escrituras.length, correcto ? 1 : 0)
    assert.equal(cierres, correcto ? 1 : 0)
    if (correcto) assert.deepEqual(e.escrituras[0], { password: 'NuevaClave123*', current_password: 'Anterior123*' })
  })
}
test('la verificación adicional de contraseña se comunica sin guardar ni revelar tokens', async () => {
  const e = cuenta({ requiereCodigo: true })
  const api = cargar('../app/api/cuenta/contrasena/route.ts', { '@/lib/cuenta/servidor': e.servidor, '@supabase/supabase-js': { createClient: () => ({ auth: { signInWithPassword: async () => ({ data: { user: { id: 'id-actual' } }, error: null }), signOut: async () => ({ error: null }) } }) } })
  const res = await api.POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ actual: 'Anterior123*', nueva: 'NuevaClave123*', confirmacion: 'NuevaClave123*' }) }))
  assert.equal(res.status, 400)
  assert.equal((await res.json()).requiereCodigo, true)
})

function paciente({ rol = 'medico', sinSesion = false, fallaPerfil = false } = {}) {
  const escrituras = []
  const original = { id: 7, usuario_id: 70, fecha_nacimiento: '1990-01-01', genero: 'F', nombre_contacto_emergencia: null, telefono_emergencia: null, usuarios: { nombre_completo: 'Paciente', correo: 'paciente@example.test', telefono: '5555555555' } }
  const db = { rpc: async (operacion, datos) => { escrituras.push({ operacion, datos }); return fallaPerfil ? { data: null, error: { code: '40001', message: 'El paciente cambió' } } : { data: { ok: true }, error: null } }, auth: { getUser: async () => ({ data: { user: sinSesion ? null : { id: 'actual' } } }) }, from(tabla) { const q = { select() { return q }, eq() { return q }, async maybeSingle() { return { data: tabla === 'usuarios' ? { rol, esta_activo: true } : original, error: null } } }; return q } }
  const admin = { from(tabla) { let cambios; const q = { update(payload) { cambios = payload; escrituras.push({ tabla, payload }); return q }, eq() { return q }, is() { return q }, select() { return q }, async maybeSingle() { return { data: fallaPerfil && tabla === 'perfiles_pacientes' ? null : { id: 7 }, error: null } }, then(resolver) { return Promise.resolve({ error: null }).then(resolver) } }; return q } }
  const api = cargar('../app/api/pacientes/[id]/route.ts', { '@/lib/supabase/server': { createClient: async () => db }, '@supabase/supabase-js': { createClient: () => admin }, '@/lib/cuenta/validacion': validacion })
  const contexto = { params: Promise.resolve({ id: '7' }) }
  const guardar = () => api.PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ nombre: 'Nombre modificado', telefono: '5511111111', fechaNacimiento: '1991-02-03', genero: 'F', contactoEmergencia: 'Contacto', telefonoEmergencia: '5599999999', correo: 'no-se-cambia@example.test', rol: 'admin', notasMedicas: 'no-se-cambia' }) }), contexto)
  return { api, contexto, guardar, escrituras }
}
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.test'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'clave-de-prueba'
test('editar paciente actualiza el registro elegido sin cambiar correo, rol ni notas médicas', async () => {
  const e = paciente()
  assert.equal((await e.guardar()).status, 200)
  assert.deepEqual(e.escrituras.map((e) => e.operacion), ['clinica_actualizar_paciente'])
  assert.equal(e.escrituras[0].datos.p_paciente, 7)
  assert.deepEqual(Object.keys(e.escrituras[0].datos.p_datos).sort(), ['contactoEmergencia','fechaNacimiento','genero','nombre','telefono','telefonoEmergencia'])
})
test('edición de pacientes exige sesión y rol clínico', async () => {
  assert.equal((await paciente({ sinSesion: true }).guardar()).status, 401)
  assert.equal((await paciente({ rol: 'paciente' }).guardar()).status, 403)
})
test('un conflicto de la transacción del paciente se comunica sin simular éxito', async () => {
  const e = paciente({ fallaPerfil: true })
  assert.equal((await e.guardar()).status, 409)
  assert.equal(e.escrituras.length, 1)
})
