import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envRaw = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envRaw
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function sincronizar() {
  console.log('--- 1. Consultando usuarios existentes en public.usuarios ---')
  const { data: usuarios, error: errU } = await supabase
    .from('usuarios')
    .select('id, correo, nombre_completo, rol, auth_user_id')

  if (errU) {
    console.error('Error al leer public.usuarios:', errU.message)
    return
  }

  console.log(`Encontrados ${usuarios.length} registros en public.usuarios.`)

  // Contraseña por defecto para todas las cuentas reales: Clinica123*
  const PASSWORD_DEFAULT = 'Clinica123*'

  for (const u of usuarios) {
    const correo = u.correo.toLowerCase().trim()
    console.log(`\nProcesando: ${correo} (${u.nombre_completo} - ${u.rol})`)

    let authUserId = u.auth_user_id

    // Verificar si ya existe en auth.users
    const { data: listData } = await supabase.auth.admin.listUsers()
    const existeEnAuth = listData?.users?.find((x) => x.email?.toLowerCase() === correo)

    if (existeEnAuth) {
      console.log(`  -> Ya existe en auth.users (ID: ${existeEnAuth.id}). Actualizando contraseña...`)
      authUserId = existeEnAuth.id
      const { error: errUpd } = await supabase.auth.admin.updateUserById(authUserId, {
        password: PASSWORD_DEFAULT,
        email_confirm: true,
        user_metadata: { nombre_completo: u.nombre_completo, rol: u.rol },
      })
      if (errUpd) console.error(`  Error actualizando: ${errUpd.message}`)
    } else {
      console.log(`  -> Creando nuevo en auth.users con contraseña '${PASSWORD_DEFAULT}'...`)
      const { data: nuevo, error: errNew } = await supabase.auth.admin.createUser({
        email: correo,
        password: PASSWORD_DEFAULT,
        email_confirm: true,
        user_metadata: { nombre_completo: u.nombre_completo, rol: u.rol },
      })
      if (errNew) {
        console.error(`  Error creando usuario: ${errNew.message}`)
        continue
      }
      authUserId = nuevo.user.id
      console.log(`  -> Creado con ID: ${authUserId}`)
    }

    // Vincular auth_user_id si estaba en NULL
    if (u.auth_user_id !== authUserId) {
      console.log(`  -> Vinculando auth_user_id en public.usuarios...`)
      const { error: errLink } = await supabase
        .from('usuarios')
        .update({ auth_user_id: authUserId, esta_activo: true })
        .eq('id', u.id)
      if (errLink) console.error(`  Error al vincular: ${errLink.message}`)
      else console.log(`  -> Vinculado con éxito!`)
    }
  }

  console.log('\n--- 2. Verificando perfiles_medicos ---')
  const { data: medicos, error: errMed } = await supabase
    .from('perfiles_medicos')
    .select('id, usuario_id, especialidad, cedula_profesional, usuarios(correo, nombre_completo)')

  if (errMed) {
    console.error('Error al leer perfiles_medicos:', errMed.message)
  } else {
    console.log(`Total perfiles médicos registrados: ${medicos.length}`)
    for (const m of medicos) {
      const nom = Array.isArray(m.usuarios) ? m.usuarios[0]?.nombre_completo : m.usuarios?.nombre_completo
      const cor = Array.isArray(m.usuarios) ? m.usuarios[0]?.correo : m.usuarios?.correo
      console.log(`  - Medico ID ${m.id}: ${nom} (${cor}) - ${m.especialidad}`)
    }
  }

  console.log('\n--- Sincronización finalizada exitosamente ---')
}

sincronizar().catch((e) => {
  console.error('Error fatal:', e)
})
