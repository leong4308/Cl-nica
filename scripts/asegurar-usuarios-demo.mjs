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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const usuariosDemo = [
  {
    email: 'recepcion1@clinicanova.com',
    nombre: 'Claudia Beatriz Núñez',
    rol: 'recepcionista',
    password: '123456',
  },
  {
    email: 'enfermero1@clinicanova.com',
    nombre: 'Luis Fernando Ortiz',
    rol: 'enfermero',
    password: '123456',
  },
]

async function asegurarUsuario(datos) {
  const { data: lista } = await admin.auth.admin.listUsers()
  const existente = lista?.users?.find((u) => u.email?.toLowerCase() === datos.email.toLowerCase())

  let authUserId
  if (existente) {
    console.log(`Usuario ${datos.email} ya existe en Auth. Actualizando contraseña a 123456...`)
    const { data: actualizado, error: errUpd } = await admin.auth.admin.updateUserById(existente.id, {
      password: datos.password,
      email_confirm: true,
      user_metadata: { nombre_completo: datos.nombre, rol: datos.rol },
    })
    if (errUpd) throw errUpd
    authUserId = actualizado.user.id
  } else {
    console.log(`Creando usuario ${datos.email} en Auth...`)
    const { data: nuevo, error: errCreate } = await admin.auth.admin.createUser({
      email: datos.email,
      password: datos.password,
      email_confirm: true,
      user_metadata: { nombre_completo: datos.nombre, rol: datos.rol },
    })
    if (errCreate) throw errCreate
    authUserId = nuevo.user.id
  }

  // Asegurar registro en public.usuarios con auth_user_id
  const { data: usuarioDb } = await admin
    .from('usuarios')
    .select('id')
    .eq('correo', datos.email)
    .maybeSingle()

  if (usuarioDb) {
    console.log(`Vinculando auth_user_id para ${datos.email}...`)
    await admin
      .from('usuarios')
      .update({ auth_user_id: authUserId, rol: datos.rol, esta_activo: true })
      .eq('id', usuarioDb.id)
  } else {
    console.log(`Insertando en public.usuarios para ${datos.email}...`)
    await admin.from('usuarios').insert({
      auth_user_id: authUserId,
      correo: datos.email,
      nombre_completo: datos.nombre,
      rol: datos.rol,
      esta_activo: true,
    })
  }

  // Probar login
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  const clientePublico = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key)
  const { data: loginData, error: errLogin } = await clientePublico.auth.signInWithPassword({
    email: datos.email,
    password: datos.password,
  })

  if (errLogin) {
    console.error(`ERROR al iniciar sesión con ${datos.email}:`, errLogin.message)
  } else {
    console.log(`LOGIN EXITOSO para ${datos.email}: token obtenido correctamente`)
  }
}

async function principal() {
  for (const u of usuariosDemo) {
    await asegurarUsuario(u)
  }
  console.log('Todos los usuarios demo asegurados con éxito!')
}

principal().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})
