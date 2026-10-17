export function Status({ text }: { text: string }) {
  const norm = (text ?? '').trim().toLowerCase()

  // Verde: Activo / Atendida / Completada / Disponible / Listo / Alta
  const esVerde = [
    'activo',
    'activa',
    'atendida',
    'completada',
    'listo',
    'lista',
    'disponible',
    'finalizada',
    'alta',
  ].some((v) => norm === v || norm.startsWith('activ') || norm === 'atendida' || norm === 'completada' || norm === 'disponible')

  // Azul: Confirmada / En proceso / En consulta / Ocupada / Programada
  const esAzul = [
    'confirmada',
    'confirmado',
    'en proceso',
    'en consulta',
    'ocupada',
    'ocupado',
    'programada',
  ].some((v) => norm === v || norm.includes('confirmad') || norm.includes('proceso') || norm.includes('consulta') || norm === 'ocupada')

  // Ámbar: Pendiente / En espera / Limpieza / Por asignar / Solicitado
  const esAmbar = [
    'pendiente',
    'en espera',
    'limpieza',
    'por asignar',
    'solicitado',
    'solicitada',
    'revision',
    'revisión',
  ].some((v) => norm === v || norm.includes('pendiente') || norm.includes('espera') || norm === 'limpieza')

  // Rojo: Inactivo / Cancelada / No asistió / Mantenimiento / Baja
  const esRojo = [
    'inactivo',
    'inactiva',
    'cancelada',
    'cancelado',
    'cancelada por paciente',
    'cancelada por médico',
    'cancelada_paciente',
    'cancelada_medico',
    'no asistió',
    'no asistio',
    'no_asistio',
    'mantenimiento',
    'baja',
  ].some((v) => norm === v || norm.startsWith('inactiv') || norm.includes('cancelad') || norm.includes('no asist'))

  let estilo = 'bg-slate-100 text-slate-600 border border-slate-200/60'
  if (esRojo) {
    estilo = 'bg-rose-50 text-rose-700 border border-rose-200/70'
  } else if (esAmbar) {
    estilo = 'bg-amber-50 text-amber-700 border border-amber-200/70'
  } else if (esAzul) {
    estilo = 'bg-blue-50 text-blue-700 border border-blue-200/70'
  } else if (esVerde) {
    estilo = 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
  }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${estilo}`}>
      {text}
    </span>
  )
}
