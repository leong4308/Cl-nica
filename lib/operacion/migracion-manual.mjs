// Reconoce instalaciones desde SQL Editor antes de registrar su hash.
// No omite una migración basándose únicamente en el número de versión.
export async function respuestasInstaladasManualmente(db, sql) {
  const funciones = [...sql.matchAll(/^create(?: or replace)? function public\.([a-z_]+)\([\s\S]*?as (\$[a-z]*\$)([\s\S]*?)\2;/gm)]
  if (!funciones.length) return false
  const existentes = (await db.query(`select p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any($1::text[])`, [funciones.flatMap(f => [f[1],f[1]+'_v24',f[1]+'_v25',f[1]+'_v26',f[1]+'_v27',f[1]+'_v28'])])).rows
  const normalizar = s => s.replace(/\r\n/g,'\n').trim()
  if (!funciones.every(f => existentes.some(p => [f[1],f[1]+'_v24',f[1]+'_v25',f[1]+'_v26',f[1]+'_v27',f[1]+'_v28'].includes(p.proname) && (f[1] === 'clinica_version'
    ? Number(/^select (\d+)$/.exec(normalizar(p.prosrc))?.[1]) >= Number(/^select (\d+)$/.exec(normalizar(f[3]))?.[1])
    : normalizar(p.prosrc) === normalizar(f[3]))))) return false
  if (sql.includes('create table public.enfermeria_turnos (')) {
    const tablas=(await db.query("select relrowsecurity from pg_class where oid in(to_regclass('public.enfermeria_turnos'),to_regclass('public.enfermeria_tareas'),to_regclass('public.enfermeria_registros'),to_regclass('public.enfermeria_acuses'),to_regclass('public.enfermeria_movimientos'))")).rows
    return tablas.length===5&&tablas.every(t=>t.relrowsecurity)
  }
  if (sql.includes('create table public.sesiones_clinica (')) {
    const tablas=(await db.query("select relname,relrowsecurity from pg_class where oid in(to_regclass('public.sesiones_clinica'),to_regclass('public.reservas_paciente'),to_regclass('public.telegram_reservas'),to_regclass('public.telegram_horas_reserva'))")).rows
    return tablas.length===4&&tablas.every(t=>t.relrowsecurity)
  }
  if (sql.includes('create table public.telegram_turnos_cita (')) {
    const t=(await db.query("select relrowsecurity from pg_class where oid=to_regclass('public.telegram_turnos_cita')")).rows[0]
    return t?.relrowsecurity===true
  }
  if (sql.includes('create table public.telegram_trabajador(')) {
    const t = (await db.query("select relrowsecurity from pg_class where oid=to_regclass('public.telegram_trabajador')")).rows[0]
    return t?.relrowsecurity === true
  }
  const tablas = (await db.query(`select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in('telegram_acciones_cita','cita_solicitudes_cambio')`)).rows
  if (tablas.length !== 2 || tablas.some(t => !t.relrowsecurity)) return false
  const columnas = (await db.query(`select table_name,column_name from information_schema.columns where table_schema='public'
    and (table_name='telegram_acciones_cita' and column_name in('token','usuario_id','cita_id','version','vence_en','vinculado_en','pregunta_id','pregunta_hasta')
    or table_name='cita_solicitudes_cambio' and column_name in('id','cita_id','usuario_id','disponibilidad','canal','estado','respuesta','creado_en','actualizado_en'))`)).rows
  return columnas.length === 17
}
