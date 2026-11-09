import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const raiz = new URL('../', import.meta.url)
const locales = Object.fromEntries(readFileSync(new URL('.env.local', raiz), 'utf8').split('\n').filter((linea) => linea.includes('=') && !linea.trim().startsWith('#')).map((linea) => {
  const i = linea.indexOf('=')
  return [linea.slice(0, i).trim(), linea.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
}))
const env = { ...locales, ...process.env }
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Configura Supabase y la clave de servicio en .env.local.')
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const cuentas = JSON.parse(readFileSync(new URL('lib/cuenta/cuentas-prueba.json', raiz), 'utf8')).filter((c) => ['enfermero', 'recepcionista'].includes(c.rol))
const clave = env.CLAVE_CUENTAS_PRUEBA || 'Clinica123*'
function comprobar(resultado, nombre) {
  if (resultado.error) throw Error(`${nombre}: ${resultado.error.message}`)
  return resultado.data
}

const clinica = comprobar(await db.from('clinicas').select('id').order('id').limit(1).maybeSingle(), 'Consultar clínica')
if (!clinica) throw Error('Primero registra una clínica para vincular enfermería.')
const existentes = []
for (let pagina = 1; ; pagina++) {
  const { users } = comprobar(await db.auth.admin.listUsers({ page: pagina, perPage: 1000 }), 'Consultar cuentas')
  existentes.push(...users)
  if (users.length < 1000) break
}

for (const cuenta of cuentas) {
  let auth = existentes.find((u) => u.email?.toLowerCase() === cuenta.correo)
  let creado = false
  try {
    if (!auth) {
      const anterior = comprobar(await db.from('usuarios').select('id').eq('correo', cuenta.correo).maybeSingle(), 'Verificar correo')
      if (anterior) throw Error(`El correo ${cuenta.correo} ya tiene un perfil sin cuenta de acceso. Revisa su vínculo antes de crear otro.`)
      const data = comprobar(await db.auth.admin.createUser({ email: cuenta.correo, password: clave, email_confirm: true, user_metadata: { nombre_completo: cuenta.nombre, rol: cuenta.rol } }), 'Crear cuenta')
      auth = data.user
      creado = true
    }
    // El trigger de Auth crea public.usuarios; no se inserta una segunda fila.
    const usuario = comprobar(await db.from('usuarios').select('id,rol,esta_activo').eq('auth_user_id', auth.id).maybeSingle(), 'Verificar perfil')
    if (!usuario || usuario.rol !== cuenta.rol || !usuario.esta_activo) throw Error(`El perfil de ${cuenta.correo} no tiene el rol activo esperado.`)
    if (cuenta.rol === 'enfermero') {
      const perfiles = comprobar(await db.from('perfiles_enfermeros').select('id,esta_activo').eq('usuario_id', usuario.id).eq('clinica_id', clinica.id), 'Consultar enfermería')
      if (!perfiles.length) comprobar(await db.from('perfiles_enfermeros').insert({ usuario_id: usuario.id, clinica_id: clinica.id, especialidad: 'Enfermería general', esta_activo: true }), 'Crear perfil de enfermería')
      else if (!perfiles.some((p) => p.esta_activo)) throw Error('El perfil de enfermería existe, pero está inactivo.')
    }
    console.log(`${creado ? 'Creada' : 'Verificada'}: ${cuenta.etiqueta} · ${cuenta.correo}`)
  } catch (error) {
    // Solo se revierte una cuenta creada en esta ejecución; nunca se cambian contraseñas existentes.
    if (creado && auth) comprobar(await db.auth.admin.deleteUser(auth.id), 'Revertir cuenta incompleta')
    throw error
  }
}
