import { readFileSync } from 'node:fs'
import pg from 'pg'
export function entorno() {
  let local = {}
  try { local = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z_][A-Z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]})) } catch {}
  return { ...local, ...process.env }
}
export function conexionSQL(valor, env = entorno()) {
  if (!valor) throw Error('Configura SUPABASE_DB_URL en .env.local. La clave de servicio no permite ejecutar SQL.')
  const url = new URL(valor)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('La conexión debe usar el protocolo postgresql.')
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
  for (const clave of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(clave)
  return new pg.Client({ connectionString: url.toString(), ssl: local ? false : { rejectUnauthorized: true, ...(env.SUPABASE_DB_CA_FILE ? { ca: readFileSync(env.SUPABASE_DB_CA_FILE,'utf8') } : {}) }, connectionTimeoutMillis: 15000 })
}
export function entornoPostgres(valor, env = entorno()) {
  const u = new URL(valor)
  return { ...process.env, PGHOST:u.hostname, PGPORT:u.port||'5432', PGUSER:decodeURIComponent(u.username), PGPASSWORD:decodeURIComponent(u.password), PGDATABASE:decodeURIComponent(u.pathname.slice(1)), PGSSLMODE:['localhost','127.0.0.1'].includes(u.hostname)?'disable':'verify-full', PGSSLROOTCERT:env.SUPABASE_DB_CA_FILE??'system' }
}
