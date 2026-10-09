import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const INTERVALO = 25

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

const { data: medicos, error: eMedicos } = await db
  .from('perfiles_medicos')
  .select('id, duracion_consulta, esta_activo, usuarios(nombre_completo)')
if (eMedicos) throw eMedicos
const activos = medicos.filter((m) => m.esta_activo)
salida.push(`médicos activos: ${activos.length}`)

const { error: eUpdMed } = await db
  .from('perfiles_medicos')
  .update({ duracion_consulta: INTERVALO })
  .eq('esta_activo', true)
  .neq('duracion_consulta', INTERVALO)
if (eUpdMed) throw eUpdMed

const { error: eUpdSlot } = await db.from('agenda_medicos').update({ duracion_slot: INTERVALO }).neq('duracion_slot', INTERVALO)
if (eUpdSlot) throw eUpdSlot

const { data: agenda } = await db.from('agenda_medicos').select('medico_id, duracion_slot')
const slotsPorMedico = new Map()
for (const a of agenda) {
  const set = slotsPorMedico.get(a.medico_id) ?? new Set()
  set.add(a.duracion_slot)
  slotsPorMedico.set(a.medico_id, set)
}

for (const m of activos) {
  const u = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios
  const slots = [...(slotsPorMedico.get(m.id) ?? [])]
  const ok = slots.length === 1 && slots[0] === INTERVALO
  salida.push(
    `  ${ok ? 'OK  ' : 'AVISO'} ${u?.nombre_compleno}: duracion_consulta=${INTERVALO}, duracion_slot=${slots.join('/') || '(sin agenda)'}`,
  )
}

writeFileSync('/tmp/intervalo.txt', salida.join('\n'))