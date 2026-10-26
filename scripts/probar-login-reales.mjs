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

const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key)

async function testLogin(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(`❌ Falló login para ${email}:`, error.message)
  } else {
    console.log(`✅ Login exitoso para ${email}: Usuario ID = ${data.user.id}`)
  }
}

async function main() {
  await testLogin('ana.lopez@clinicanova.com', 'Clinica123*')
  await testLogin('jorge.mendez@clinicanova.com', 'Clinica123*')
  await testLogin('laura.ruiz@clinicanova.com', 'Clinica123*')
  await testLogin('admin@admin.com', 'Clinica123*')
}

main().catch(console.error)
