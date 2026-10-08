/**
 * Aplica la migración 015 (jornada de tarde, 14 citas de 25 min, de lunes a domingo).
 *
 * PostgREST no permite DDL, así que en vez de correr el .sql: borra la agenda
 * anterior e inserta los bloques reales. Los `medico_id` se resuelven por nombre
 * (lo único estable entre entornos), igual que hace la migración.
 *
 * Idempotente. Uso: node tests/aplicar-horarios.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const salida = []
const DIAS = [0, 1, 2, 3, 4, 5, 6]
/** Ver supabase/migraciones/013_intervalo_25_min.sql: debe coincidir con
 *  `perfiles_medicos.duracion_consulta`. Si difieren, la pantalla ofrece
 *  horarios que se traslapan entre sí. */
const DURACION_SLOT = 25

/** Las 2 ventanas "HH:MM-HH:MM" que comparten los 6 médicos.
 *
 *  Jornada de tarde cada 25 min, de lunes a domingo, con la comida fuera:
 *
 *    13:00-14:15    3 citas   1:00 PM ... 1:50 PM
 *    15:30-20:05   11 citas   3:30 PM ... 7:40 PM
 *                               = 14 citas por médico por día
 *
 *  No se ofrece nada entre las 1:50 PM y las 3:30 PM.
 *
 *  El fin de 14:15 y el inicio de 15:30 no son arbitrarios: son los únicos que
 *  dejan fuera a las 2:15 PM y a las 3:05 PM. Ver
 *  supabase/migraciones/015_horario_continuo.sql. */
const VENTANAS = ['13:00-14:15', '15:30-20:05']

/** nombre exacto en public.usuarios.nombre_completo -> sus ventanas.
 *  Todos los médicos comparten la misma jornada. */
const HORARIOS = {
  'Dr. Carlos Mendoza': VENTANAS,
  'Dra. Ana López Martínez': VENTANAS,
  'Dr. Jorge Méndez Ruiz': VENTANAS,
  'Dra. Laura Sánchez Ortiz': VENTANAS,
  'Dr. Carlos Ramírez Peña': VENTANAS,
  'Dra. Sofía Herrera Díaz': VENTANAS,
}

const { data: medicos, error: eMedicos } = await db
  .from('perfiles_medicos')
  .select('id, usuario_id, esta_activo, usuarios(nombre_completo)')
if (eMedicos) throw eMedicos

// Resuelve nombre -> id de perfiles_medicos, igual que el `join` del .sql.
const porNombre = new Map()
for (const m of medicos.filter((m) => m.esta_activo)) {
  const u = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios
  porNombre.set(u?.nombre_completo, m.id)
}

const faltantes = Object.keys(HORARIOS).filter((n) => !porNombre.has(n))
const sobrantes = [...medicos].filter((m) => m.esta_activo).filter((m) => {
  const u = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios
  return !HORARIOS[u?.nombre_completo]
})
salida.push(`médicos activos: ${medicos.filter((m) => m.esta_activo).length}`)
if (faltantes.length) salida.push(`ERROR: no encontré estos médicos: ${faltantes.join(', ')}`)
if (sobrantes.length) {
  salida.push(`ERROR: médicos activos sin horario definido: ${sobrantes.map((m) => m.id).join(', ')}`)
}
if (faltantes.length || sobrantes.length) {
  writeFileSync('/tmp/horarios.txt', salida.join('\n'))
  process.exitCode = 1
} else {
  const filas = []
  for (const [nombre, ventanas] of Object.entries(HORARIOS)) {
    for (const f of ventanas) {
      const [inicio, fin] = f.split('-')
      for (const dia of DIAS) {
        filas.push({
          medico_id: porNombre.get(nombre),
          dia_semana: dia,
          hora_inicio: `${inicio}:00`,
          hora_fin: `${fin}:00`,
          duracion_slot: DURACION_SLOT,
        })
      }
    }
  }

  const { error: eBorrar } = await db.from('agenda_medicos').delete().neq('id', -1)
  if (eBorrar) throw eBorrar
  const { error: eInsertar } = await db.from('agenda_medicos').insert(filas)
  if (eInsertar) throw eInsertar
  salida.push(`agenda borrada y ${filas.length} bloques insertados (slot de ${DURACION_SLOT} min)`)

  const { data: final } = await db.from('agenda_medicos').select('medico_id, dia_semana, hora_inicio, hora_fin')
  salida.push(`total filas: ${final.length}`)
  const resumen = new Map()
  for (const a of final) {
    const clave = `${a.medico_id}`
    if (!resumen.has(clave)) resumen.set(clave, { ventanas: new Set(), dias: new Set(), n: 0 })
    const r = resumen.get(clave)
    r.ventanas.add(`${String(a.hora_inicio).slice(0, 5)}-${String(a.hora_fin).slice(0, 5)}`)
    r.dias.add(a.dia_semana)
    r.n += 1
  }
  const nombreDe = new Map([...porNombre].map(([n, id]) => [id, n]))
  for (const [id, r] of [...resumen].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    salida.push(`  ${nombreDe.get(id) ?? id}: ${[...r.ventanas].sort().join(' · ')} (${r.dias.size} días, ${r.n} filas)`)
    if (r.n !== 14 || r.dias.size !== 7) {
      salida.push(`  AVISO: médico ${id} quedó con ${r.n} filas en ${r.dias.size} días (se esperaban 14 en 7)`)
    }
  }
  writeFileSync('/tmp/horarios.txt', salida.join('\n'))
}