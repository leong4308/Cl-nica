/**
 * Pruebas de la lógica pura del panel de check-in.
 *
 * No reimplementa nada: EXTRAE las funciones reales del .tsx/.ts que se
 * despliegan, las transpila y las ejecuta. Si alguien edita `estadoDe` o
 * `tituloDia` en el componente, estas pruebas lo detectan.
 *
 * Uso: node --test pruebas/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

const RAIZ = new URL('..', import.meta.url)

/** Devuelve el índice justo después del paréntesis que abre en `i`. */
function finDeParentesis(fuente, i) {
  let profundidad = 0
  for (; i < fuente.length; i++) {
    if (fuente[i] === '(') profundidad++
    else if (fuente[i] === ')') {
      profundidad--
      if (profundidad === 0) return i + 1
    }
  }
  return fuente.length
}

/**
 * Tras cerrar los parámetros de una arrow function la expresión no termina:
 * sigue el `=> { cuerpo }`. Se mira lo que hay justo después (saltando espacios)
 * para no cortar la declaración a la mitad.
 */
function sigueExpresion(fuente, desde) {
  const resto = fuente.slice(desde).replace(/^[ \t]*/, '')
  return /^(=>|:)/.test(resto)
}

/** Salta espacios y comentarios y devuelve el índice del siguiente carácter real. */
function siguienteToken(fuente, desde) {
  let i = desde
  for (;;) {
    while (i < fuente.length && /\s/.test(fuente[i])) i++
    if (fuente.startsWith('//', i)) {
      const fin = fuente.indexOf('\n', i)
      i = fin === -1 ? fuente.length : fin + 1
      continue
    }
    if (fuente.startsWith('/*', i)) {
      const fin = fuente.indexOf('*/', i)
      i = fin === -1 ? fuente.length : fin + 2
      continue
    }
    return i < fuente.length ? i : -1
  }
}

/**
 * ¿La expresión sigue después de este punto? Sin esto, `const X = new Set([`
 * se cortaría en el salto de línea y se tragaría la declaración al bloque
 * completo de `estadoDe`, `aIsoLocal` y `tituloDia`.
 */
function continuaExpresion(fuente, desde) {
  const i = siguienteToken(fuente, desde)
  if (i === -1) return false
  if (/[.[(+*/%,?:<>=&|?-]/.test(fuente[i])) return true
  return /^(as|satisfies|instanceof)\b/.test(fuente.slice(i, i + 12))
}

/** Devuelve el fin de una expresión que empieza en `i`, equilibrando llaves. */
function finDeExpresion(fuente, i) {
  let profundidad = 0
  for (; i < fuente.length; i++) {
    const c = fuente[i]
    if (c === '{' || c === '[' || c === '(') profundidad++
    else if (c === '}' || c === ']' || c === ')') {
      profundidad--
      if (profundidad === 0 && !continuaExpresion(fuente, i + 1)) return i + 1
    } else if ((c === ';' || c === '\n') && profundidad === 0 && !continuaExpresion(fuente, i + 1)) return i
  }
  return fuente.length
}

/**
 * Extrae una declaración real del fuente.
 *
 * `function X(...) { ... }` se localize por sus paréntesis de parámetros: buscar
 * un `=` a partir de ahí es un error, porque el cuerpo suele traer template
 * literals (`${...}`) y el `=` aparecería dentro de ellos.
 * `const X = <expr>` sí se ancla en el `=`, y si el valor es un escalar
 * (`const X = 10`) se corta al final de la línea.
 */
function extraer(fuente, nombre) {
  const fn = new RegExp(`function ${nombre}\\s*\\(`).exec(fuente)
  if (fn) {
    const finParams = finDeParentesis(fuente, fuente.indexOf('(', fn.index))
    const cuerpo = cuerpoDeFuncion(fuente, finParams)
    if (cuerpo === -1) throw new Error(`"${nombre}": no se encontró el cuerpo`)
    return fuente.slice(fn.index, finDeExpresion(fuente, cuerpo))
  }

  const cte = new RegExp(`(?:const|let) ${nombre}\\s*(?::[^=\\n]+)?=`).exec(fuente)
  if (cte) {
    const finCte = cte.index + cte[0].length - 1
    const inicio = siguienteToken(fuente, finCte + 1)
    return fuente.slice(cte.index, finDeExpresion(fuente, inicio === -1 ? finCte + 1 : inicio))
  }

  throw new Error(`No se encontró la declaración de "${nombre}"`)
}

/**
 * Localiza la llave que abre el cuerpo de una función, ya pasada la lista de
 * parámetros. Ojo: el tipo de retorno puede ser un objeto, como en
 * `rangoIso(...): { inicio: string; fin: string } {`, y su llave se confunde
 * con el cuerpo. Si tras la primera llave equilibrada viene otra llave, la
 * primera era el tipo y el cuerpo es la segunda.
 */
function cuerpoDeFuncion(fuente, desde) {
  let i = siguienteToken(fuente, desde)
  while (i !== -1 && fuente[i] !== '{' && fuente[i] !== ';') i = siguienteToken(fuente, i + 1)
  if (i === -1 || fuente[i] !== '{') return -1
  const finPrimera = finDeExpresion(fuente, i)
  const k = siguienteToken(fuente, finPrimera)
  return fuente[k] === '{' ? k : i
}

/** Carga declaraciones reales desde un archivo del proyecto y las ejecuta. */
function cargar(archivo, nombres) {
  const fuente = readFileSync(new URL(archivo, RAIZ), 'utf8')
  const codigo = nombres.map((n) => extraer(fuente, n)).join('\n\n')
  const js = ts.transpileModule(codigo, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  if (process.env.DEBUG_EXTRACT) writeFileSync('/tmp/extract.txt', `${codigo}\n\n===== JS =====\n${js}`)
  return new Function(`${js}\nreturn { ${nombres.join(', ')} }`)()
}

const { estadoDe, aIsoLocal, tituloDia, formatearHora, FILTROS } = cargar(
  'components/modulos/resumen/proximas-citas/proximas-citas.tsx',
  ['MINUTOS_CORTESIA', 'ESTADOS_FINALES', 'estadoDe', 'aIsoLocal', 'tituloDia', 'formatearHora', 'FILTROS'],
)
const { horaDe, aMinutos, rangoIso, nombreDia } = cargar(
  'lib/supabase/datos.ts',
  ['horaDe', 'aMinutos', 'rangoIso', 'NOMBRE_DIA', 'fechaLocal', 'nombreDia'],
)

const AHORA = new Date('2026-10-03T09:20:00')

/**
 * CitaPanel cuyo inicio cae `minutos` respecto a AHORA.
 * Negativo = en el pasado (la cita ya empezó), positivo = en el futuro.
 */
const cita = (minutos, estado = 'Pendiente') => ({ estado, inicio: AHORA.getTime() + minutos * 60_000 })
const estadoEn = (minutos, estado) => estadoDe(cita(minutos, estado), AHORA.getTime())

// ---------------------------------------------------------------------------
test('estadoDe: la frontera de los 10 minutos es exacta', () => {
  assert.equal(estadoEn(60), 'Confirmada', 'una hora en el futuro es Actual')
  assert.equal(estadoEn(1), 'Confirmada', 'un minuto en el futuro sigue siendo Actual')
  assert.equal(estadoEn(0), 'Pendiente', 'justo al empezar entra a Pendientes')
  assert.equal(estadoEn(-9.9), 'Pendiente', '9.9 min antes sigue dentro de la cortesía')
  assert.equal(estadoEn(-10), 'Pendiente', 'exactamente 10 min antes sigue en Pendientes (<=)')
  assert.equal(estadoEn(-10.1), 'Reagendar', '10.1 min ya venció la cortesía')
  assert.equal(estadoEn(-11), 'Reagendar', '11 min ya es Reagendar')
  assert.equal(estadoEn(-1440), 'Reagendar', 'una cita de ayer cae en Reagendar')
})

test('estadoDe: los estados finales salen del panel', () => {
  for (const estado of ['Atendida', 'No asistió', 'Cancelada por paciente', 'Cancelada por médico']) {
    assert.equal(estadoEn(5, estado), null, `${estado} debe salir del panel`)
    assert.equal(estadoEn(-600, estado), null, `${estado} de hace 10 h sigue fuera`)
  }
})

test('estadoDe: el estado de la BD no altera la clasificación temporal', () => {
  assert.equal(estadoEn(30, 'Confirmada'), 'Confirmada', 'futura y confirmada es Actual')
  assert.equal(estadoEn(-5, 'Confirmada'), 'Pendiente', 'ya empezó: toca check-in')
  assert.equal(estadoEn(-60, 'Pendiente'), 'Reagendar', 'vencida sin check-in se reactiva')
})
test('tituloDia: Hoy, Mañana y fecha legible', () => {
  assert.equal(tituloDia('2026-10-03', '2026-10-03', '2026-10-04'), 'Hoy')
  assert.equal(tituloDia('2026-10-04', '2026-10-03', '2026-10-04'), 'Mañana')
  const largo = tituloDia('2026-10-05', '2026-10-03', '2026-10-04')
  assert.match(largo, /lunes/i, `se esperaba "lunes, 5 de octubre", llegó "${largo}"`)
  assert.match(largo, /5/, 'debe incluir el número de día')
})

test('aIsoLocal: siempre AAAA-MM-DD, sin corrimiento de zona', () => {
  assert.equal(aIsoLocal(new Date(2026, 0, 5)), '2026-01-05', 'padece de día y mes')
  assert.equal(aIsoLocal(new Date(2026, 11, 25)), '2026-12-25')
  assert.equal(aIsoLocal(new Date('2026-10-03T23:30:00')), '2026-10-03')
})

test('formatearHora: 12 h con AM/PM correctos', () => {
  assert.equal(formatearHora('09:00'), '9:00 AM')
  assert.equal(formatearHora('13:30'), '1:30 PM')
  assert.equal(formatearHora('12:00'), '12:00 PM', 'mediodía es 12 PM')
  assert.equal(formatearHora('00:00'), '12:00 AM', 'medianoche es 12 AM')
  assert.equal(formatearHora('23:59'), '11:59 PM')
  assert.equal(formatearHora('—'), '—', 'un valor inválido se devuelve tal cual')
})

test('horaDe (datos.ts): formato 24 h parseable', () => {
  const h = horaDe('2026-10-03T15:30:00')
  assert.match(h, /^\d{2}:\d{2}$/, `debe ser HH:MM sin AM/PM, llegó "${h}"`)
})

test('rangoIso: arma el intervalo en hora local sin corrimiento', () => {
  const { inicio, fin } = rangoIso('2026-10-05', '09:00', 30)
  const i = new Date(inicio)
  assert.equal(i.getFullYear(), 2026)
  assert.equal(i.getMonth(), 9)
  assert.equal(i.getDate(), 5)
  assert.equal(i.getHours(), 9, 'la hora local debe quedar en 09:00, no desplazada')
  assert.equal((new Date(fin) - i) / 60_000, 30, 'la duración se respeta')
})

test('rangoIso: rechaza horas imposibles en vez de corrumpir el día', () => {
  // "25:00" pasaría el filtro de forma y `new Date(y, m, d, 25, 0)` se
  // normalizaría al día siguiente: la cita se guardaría en otra fecha.
  assert.throws(() => rangoIso('2026-10-05', '25:00', 30), /no válida/)
  assert.throws(() => rangoIso('2026-10-05', '09:75', 30), /no válida/)
  assert.throws(() => rangoIso('2026-10-05', '13:00 PM', 30), /no válida/, '13 PM no es una hora válida')
})

test('rangoIso: acepta el formato de 12 h que muestra la interfaz', () => {
  const { inicio } = rangoIso('2026-10-05', '2:30 PM', 30)
  const i = new Date(inicio)
  assert.equal(i.getHours(), 14, '2:30 PM son las 14:30')
  assert.equal(i.getMinutes(), 30)
  assert.equal(i.getDate(), 5, 'no debe cambiar de día')

  const am = new Date(rangoIso('2026-10-05', '12:00 AM', 30).inicio)
  assert.equal(am.getHours(), 0, '12:00 AM es medianoche')
})

test('nombreDia: solo el nombre del día, sin "Hoy"/"Mañana" ni fecha', () => {
  // 2026-10-05 es lunes. Las tarjetas del selector muestran únicamente el día
  // real del calendario, en el orden en que lo devuelve Date.getDay().
  assert.equal(nombreDia('2026-10-05'), 'Lunes', 'lunes, 5 de octubre')
  assert.equal(nombreDia('2026-10-06'), 'Martes')
  assert.equal(nombreDia('2026-10-07'), 'Miércoles', 'la e lleva tilde')
  assert.equal(nombreDia('2026-10-08'), 'Jueves')
  assert.equal(nombreDia('2026-10-09'), 'Viernes')
  assert.equal(nombreDia('2026-10-10'), 'Sábado')
  assert.equal(nombreDia('2026-10-11'), 'Domingo', 'la semana cierra en domingo')

  // Ninguna fecha puede salir como "Hoy" o "Mañana": el rótulo depende solo del
  // calendario, no de cuándo se mire la pantalla.
  assert.equal(nombreDia('2026-10-03'), 'Sábado')
  assert.equal(nombreDia('2026-10-04'), 'Domingo')

  // Siete días consecutivos = los siete nombres, sin repetir ni saltarse uno.
  const semana = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
    .map(nombreDia)
  assert.deepEqual(semana, ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
  assert.equal(new Set(semana).size, 7, 'ningún día se repite dentro de la semana')
})

test('nombreDia: cruza los fines de mes sin corrirse de día', () => {
  assert.equal(nombreDia('2026-10-31'), 'Sábado')
  assert.equal(nombreDia('2026-11-01'), 'Domingo', 'el cambio de mes no mueve el día')
  assert.equal(nombreDia('2027-01-01'), 'Viernes')
})

test('FILTROS: sin "todas" y con los tres estados del flujo', () => {
  assert.deepEqual(FILTROS.map((f) => f.etiqueta), ['Actuales', 'Pendientes', 'Reagendar'])
  assert.equal(FILTROS.length, 3, 'no debe existir un filtro "Todas"')
})

test('agrupado por día: bloques cronológicos y citas ordenadas', () => {
  // Replica el agrupado del componente para validar el contrato completo.
  const mk = (iso, h, m) => ({
    estado: 'Pendiente',
    inicio: new Date(`${iso}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime(),
  })
  const crudas = [mk('2026-10-04', 10, 30), mk('2026-10-05', 15, 0), mk('2026-10-05', 9, 0), mk('2026-10-05', 11, 0)]

  const clasificadas = crudas
    .map((c) => ({ cita: c, estado: estadoDe(c, AHORA.getTime()) }))
    .filter((i) => i.estado !== null)
    .sort((a, b) => a.cita.inicio - b.cita.inicio)

  const bloques = new Map()
  for (const item of clasificadas) {
    const iso = aIsoLocal(new Date(item.cita.inicio))
    if (bloques.has(iso)) bloques.get(iso).push(item)
    else bloques.set(iso, [item])
  }

  assert.deepEqual([...bloques.keys()], ['2026-10-04', '2026-10-05'], 'los bloques salen en orden cronológico')
  assert.equal(bloques.get('2026-10-05').length, 3)
  const horas = bloques.get('2026-10-05').map((i) => new Date(i.cita.inicio).getHours())
  assert.deepEqual(horas, [9, 11, 15], 'dentro del día las citas van de menor a mayor')
})