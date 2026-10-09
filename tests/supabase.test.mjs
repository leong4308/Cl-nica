import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const RAIZ = new URL('..', import.meta.url)
const env = Object.fromEntries(
  readFileSync(new URL('.env.local', RAIZ), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let citas = []
let medicos = []
let pacientes = []

before(async () => {
  const [c, m, p] = await Promise.all([
    db.from('citas').select('id, inicio, fin, estado, medico_id, paciente_id'),
    db.from('perfiles_medicos').select('id, duracion_consulta, esta_activo'),
    db.from('perfiles_pacientes').select('id, usuario_id'),
  ])
  assert.equal(c.error, null, `citas: ${c.error?.message}`)
  assert.equal(m.error, null, `perfiles_medicos: ${m.error?.message}`)
  assert.equal(p.error, null, `perfiles_pacientes: ${p.error?.message}`)
  citas = c.data
  medicos = m.data
  pacientes = p.data
})

test('los estados usados en la base pertenecen al enum esperado', async () => {
  const { data: filas } = await db.from('citas').select('estado').limit(1000)
  const validos = ['pendiente', 'confirmada', 'atendida', 'cancelada_paciente', 'cancelada_medico', 'no_asistio']
  for (const u of [...new Set(filas.map((f) => f.estado))]) {
    assert.ok(validos.includes(u), `estado inesperado en la base: "${u}"`)
  }
})

test('toda cita tiene duración positiva y fin posterior al inicio', () => {
  for (const c of citas) {
    const ini = new Date(c.inicio).getTime()
    const fin = new Date(c.fin).getTime()
    assert.ok(Number.isFinite(ini), `cita ${c.id}: inicio inválido "${c.inicio}"`)
    assert.ok(fin > ini, `cita ${c.id}: fin (${c.fin}) no es posterior al inicio (${c.inicio})`)
  }
})

test('ninguna cita apunta a un médico o paciente inexistente', () => {
  const idsMedico = new Set(medicos.map((m) => m.id))
  const idsPaciente = new Set(pacientes.map((p) => p.id))
  const huerfanas = citas.filter((c) => !idsMedico.has(c.medico_id) || !idsPaciente.has(c.paciente_id))
  assert.deepEqual(huerfanas.map((c) => c.id), [], `citas huérfanas: ${huerfanas.map((c) => c.id)}`)
})

const VENTANAS_ESPERADAS = ['13:00-14:15', '15:30-20:05']
const HORARIO_ESPERADO = {
  'Dr. Carlos Mendoza': VENTANAS_ESPERADAS,
  'Dra. Ana López Martínez': VENTANAS_ESPERADAS,
  'Dr. Jorge Méndez Ruiz': VENTANAS_ESPERADAS,
  'Dra. Laura Sánchez Ortiz': VENTANAS_ESPERADAS,
  'Dr. Carlos Ramírez Peña': VENTANAS_ESPERADAS,
  'Dra. Sofía Herrera Díaz': VENTANAS_ESPERADAS,
}

test('cada médico tiene su horario real, los 7 días', async () => {
  const { data: medicos, error: eMedicos } = await db
    .from('perfiles_medicos')
    .select('id, esta_activo, usuarios(nombre_completo)')
  assert.equal(eMedicos, null, `perfiles_medicos: ${eMedicos?.message}`)

  const { data: agenda, error } = await db.from('agenda_medicos').select('medico_id, dia_semana, hora_inicio, hora_fin')
  assert.equal(error, null, `agenda_medicos: ${error?.message}`)

  const activos = medicos.filter((m) => m.esta_activo)
  assert.equal(activos.length, 6, `se esperaban 6 médicos activos, hay ${activos.length}`)

  for (const m of activos) {
    const u = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios
    const esperado = HORARIO_ESPERADO[u?.nombre_completo]
    assert.ok(esperado, `falta el horario esperado de "${u?.nombre_completo}" en la prueba`)

    const suyos = agenda.filter((a) => a.medico_id === m.id)
    const ventanas = [...new Set(suyos.map((a) => `${String(a.hora_inicio).slice(0, 5)}-${String(a.hora_fin).slice(0, 5)}`))].sort()
    assert.deepEqual(ventanas, [...esperado].sort(), `${u?.nombre_completo}: ventanas incorrectas`)

    const dias = new Set(suyos.map((a) => a.dia_semana))
    assert.deepEqual([...dias].sort(), [0, 1, 2, 3, 4, 5, 6], `${u?.nombre_completo}: debe atender los 7 días`)
    assert.equal(suyos.length, 14, `${u?.nombre_completo}: 2 ventanas × 7 días = 14 bloques`)
  }
})

test('los 6 médicos comparten exactamente la misma jornada', async () => {
  const { data: agenda } = await db.from('agenda_medicos').select('medico_id, hora_inicio, hora_fin')
  const porMedico = new Map()
  for (const a of agenda) {
    const lista = porMedico.get(a.medico_id) ?? []
    lista.push(`${String(a.hora_inicio).slice(0, 5)}-${String(a.hora_fin).slice(0, 5)}`)
    porMedico.set(a.medico_id, lista)
  }
  const firmas = new Set([...porMedico.values()].map((l) => [...new Set(l)].sort().join('|')))
  assert.equal(
    firmas.size,
    1,
    `todos los médicos deben compartir la jornada; hay ${firmas.size} variantes: ${[...firmas].join(' | ')}`,
  )
})

const CITAS_FUERA_DEL_HORARIO_ACTUAL = new Set([12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24])

test('las citas nuevas caen dentro del horario del médico', async () => {
  const { data: agenda, error } = await db.from('agenda_medicos').select('medico_id, dia_semana, hora_inicio, hora_fin')
  assert.equal(error, null, `agenda_medicos: ${error?.message}`)
  assert.ok(agenda.length > 0, 'no hay agendas cargadas')

  const porMedico = new Map()
  for (const h of agenda) {
    const lista = porMedico.get(h.medico_id) ?? []
    lista.push(h)
    porMedico.set(h.medico_id, lista)
  }

  const fuera = []
  for (const c of citas) {
    const d = new Date(c.inicio)
    const minutos = d.getHours() * 60 + d.getMinutes()
    const dentro = (porMedico.get(c.medico_id) ?? []).filter((h) => h.dia_semana === d.getDay()).some((h) => {
      const [hi, mi] = String(h.hora_inicio).split(':').map(Number)
      const [hf, mf] = String(h.hora_fin).split(':').map(Number)
      return minutos >= hi * 60 + mi && minutos < hf * 60 + mf
    })
    if (!dentro) fuera.push(c.id)
  }

  const nuevas = fuera.filter((id) => !CITAS_FUERA_DEL_HORARIO_ACTUAL.has(id))
  assert.deepEqual(
    nuevas,
    [],
    `citas fuera del horario que no son heredadas de la agenda anterior: ${nuevas.join(', ')}. ` +
      `Heredadas hoy: ${fuera.join(', ')}`,
  )
})

test('las citas del fin de semana son válidas desde que la clínica abre', () => {
  const finde = citas.filter((c) => {
    const d = new Date(c.inicio).getDay()
    return d === 0 || d === 6
  })
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const futuras = finde.filter((c) => new Date(c.inicio) >= inicio)
  for (const c of futuras) {
    const d = new Date(c.inicio)
    assert.ok(
      d.getHours() >= 13 && d.getHours() <= 19,
      `cita ${c.id} fuera del horario de fin de semana (${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')})`,
    )
  }
})

const CUENTAS_AUTH_SIN_PERFIL_CONOCIDAS = new Set(['mandarina@doc.com'])

test('no hay usuarios de auth sin perfil clínico', async () => {
  const { data: auth, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  assert.equal(error, null, `auth: ${error?.message}`)

  const { data: usuarios, error: eUsuarios } = await db.from('usuarios').select('auth_user_id')
  assert.equal(eUsuarios, null, `usuarios: ${eUsuarios?.message}`)
  const conPerfil = new Set(usuarios.map((u) => u.auth_user_id).filter(Boolean))

  const huerfanos = auth.users.filter((u) => !conPerfil.has(u.id))
  const nuevos = huerfanos.filter((u) => !CUENTAS_AUTH_SIN_PERFIL_CONOCIDAS.has(u.email))
  assert.deepEqual(
    nuevos.map((u) => u.email),
    [],
    `cuentas de auth sin perfil: ${huerfanos.map((u) => u.email).join(', ')}`,
  )
})

test('ningún select usa un recurso incrustado mal escrito', async () => {
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey)

  const { error: eLogin } = await anon.auth.signInWithPassword({ email: 'doc@doc.com', password: '123456' })
  assert.equal(eLogin, null, `no se pudo iniciar sesión: ${eLogin?.message}`)

  const CONSULTA_INTERNACION =
    'id, fecha_ingreso, estado, habitaciones(numero), camas(numero, esta_ocupada), perfiles_pacientes(usuarios(nombre_completo))'

  const { error } = await anon
    .from('internaciones')
    .select(CONSULTA_INTERNACION)
    .order('fecha_ingreso', { ascending: false })
    .limit(100)

  assert.equal(
    error,
    null,
    `la consulta de internaciones falla (${error?.code}: ${error?.message}). ` +
      `Revisa que los recursos incrustados coincidan con los nombres de las tablas.`,
  )
})

test('el paso entre horarios coincide con la duración de la consulta', async () => {
  const { data: medicos, error: eMedicos } = await db
    .from('perfiles_medicos')
    .select('id, duracion_consulta, esta_activo')
  assert.equal(eMedicos, null, `perfiles_medicos: ${eMedicos?.message}`)

  const { data: agenda, error } = await db.from('agenda_medicos').select('medico_id, duracion_slot')
  assert.equal(error, null, `agenda_medicos: ${error?.message}`)

  for (const m of medicos.filter((x) => x.esta_activo)) {
    assert.equal(m.duracion_consulta, 25, `médico ${m.id}: la consulta debe durar 25 min`)

    const slots = [...new Set(agenda.filter((a) => a.medico_id === m.id).map((a) => a.duracion_slot))]
    assert.deepEqual(slots, [25], `médico ${m.id}: el paso entre horarios debe ser 25 min`)
  }
})

test('la ventana del panel entra completa en el tope de 100 filas', async () => {
  const hoy = new Date()
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 7)
  const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
  const { data, error } = await db
    .from('citas')
    .select('inicio')
    .gte('inicio', inicioDia(hoy))
    .lt('inicio', inicioDia(fin))
    .order('inicio', { ascending: true })
    .limit(100)
  assert.equal(error, null, `panel: ${error?.message}`)

  const tiempos = data.map((c) => new Date(c.inicio).getTime())
  assert.deepEqual(tiempos, [...tiempos].sort((a, b) => a - b), 'Supabase debe devolver la ventana ordenada')
  assert.ok(tiempos.length < 100, `la ventana llegó al tope (${tiempos.length}/100): hay citas que no se ven`)
})
test('no hay traslapes de citas para un mismo médico', () => {
  const porMedico = new Map()
  for (const c of [...citas].sort((a, b) => new Date(a.inicio) - new Date(b.inicio))) {
    const lista = porMedico.get(c.medico_id) ?? []
    const previa = lista[lista.length - 1]
    if (previa && new Date(c.inicio) < new Date(previa.fin)) {
      assert.fail(`cita ${c.id} se traslapa con ${previa.id} para el médico ${c.medico_id}`)
    }
    lista.push(c)
    porMedico.set(c.medico_id, lista)
  }
})