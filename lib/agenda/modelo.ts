export const ZONA_CLINICA = 'America/Mexico_City'
export type BloqueAgenda = { dia: number; inicio: string; fin: string; paso?: number }
export type DescansoAgenda = { fecha: string; inicio: string; fin: string; motivo?: string }
export type IntervaloAgenda = { inicio: string; fin: string; estado?: string }
export type TurnoAgenda = { inicio: string; fin: string; hora: string; finHora: string }
export type ResumenAgenda = { configurado: boolean; bloques: BloqueAgenda[]; descansos: DescansoAgenda[]; duracionConsulta: number; dias: { fecha: string; slots: TurnoAgenda[] }[]; jornadaMinutos: number; ocupadosMinutos: number; proximo: TurnoAgenda | null; proximaCita: IntervaloAgenda | null; actualizado: string }
const partes = (fecha: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CLINICA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(fecha).map((p) => [p.type, p.value]))
export function fechaClinica(fecha = new Date()): string { const p = partes(fecha); return `${p.year}-${p.month}-${p.day}` }
export function sumarDias(fecha: string, cantidad: number): string { const d = new Date(fecha + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + cantidad); return d.toISOString().slice(0, 10) }
export function minutosHora(hora: string): number { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw Error('La hora no es válida.'); const [h, m] = hora.split(':').map(Number); return h * 60 + m }
export function instanteClinica(fecha: string, hora: string): string {
  minutosHora(hora)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw Error('La fecha no es válida.')
  const objetivo = Date.parse(`${fecha}T${hora}:00Z`)
  if (!Number.isFinite(objetivo) || new Date(objetivo).toISOString().slice(0, 10) !== fecha) throw Error('La fecha no es válida.')
  let t = objetivo
  for (let i = 0; i < 3; i++) { const p = partes(new Date(t)); const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`); t += objetivo - local }
  const resultado = new Date(t), p = partes(resultado)
  if (`${p.year}-${p.month}-${p.day}` !== fecha || `${p.hour}:${p.minute}` !== hora) throw Error('Ese horario no existe en la zona de la clínica.')
  return resultado.toISOString()
}
export function horaClinica(iso: string): string { return new Date(iso).toLocaleTimeString('es-MX', { timeZone: ZONA_CLINICA, hour: '2-digit', minute: '2-digit', hour12: true }) }
export function validarBloques(valor: unknown): BloqueAgenda[] {
  if (!Array.isArray(valor) || valor.length > 42) throw Error('Revisa los bloques de horario.')
  const bloques = valor.map((b) => {
    if (!b || !Number.isInteger(b.dia) || b.dia < 0 || b.dia > 6 || typeof b.inicio !== 'string' || typeof b.fin !== 'string') throw Error('Revisa el día y las horas de cada bloque.')
    if (minutosHora(b.inicio) >= minutosHora(b.fin)) throw Error('La hora de cierre debe ser posterior a la de apertura.')
    if (b.paso !== undefined && (!Number.isInteger(b.paso) || b.paso < 5 || b.paso > 240)) throw Error('Revisa el intervalo entre turnos.')
    return { dia: b.dia, inicio: b.inicio, fin: b.fin, ...(b.paso ? { paso: b.paso } : {}) } as BloqueAgenda
  }).sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio))
  for (let i = 1; i < bloques.length; i++) if (bloques[i].dia === bloques[i - 1].dia && bloques[i].inicio < bloques[i - 1].fin) throw Error('Los bloques del mismo día no pueden superponerse.')
  return bloques
}
export function validarDescansos(valor: unknown): DescansoAgenda[] {
  if (!Array.isArray(valor) || valor.length > 180) throw Error('Registra como máximo 180 descansos por médico.')
  const lista = valor.map((d) => {
    if (!d || typeof d.fecha !== 'string' || typeof d.inicio !== 'string' || typeof d.fin !== 'string' || (d.motivo !== undefined && typeof d.motivo !== 'string')) throw Error('Revisa la fecha y horas de los descansos.')
    instanteClinica(d.fecha, d.inicio); instanteClinica(d.fecha, d.fin)
    if (minutosHora(d.fin) <= minutosHora(d.inicio)) throw Error('El descanso debe terminar después de su inicio, dentro del mismo día.')
    if ((d.motivo?.length ?? 0) > 200) throw Error('La nota de un descanso admite hasta 200 caracteres.')
    return { fecha: d.fecha, inicio: d.inicio, fin: d.fin, motivo: d.motivo?.trim() || '' } as DescansoAgenda
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio))
  for (let i = 1; i < lista.length; i++) if (lista[i].fecha === lista[i - 1].fecha && lista[i].inicio < lista[i - 1].fin) throw Error('Los descansos de una fecha no pueden superponerse.')
  return lista
}
export function intervaloDescanso(d: DescansoAgenda): IntervaloAgenda { return { inicio: instanteClinica(d.fecha, d.inicio), fin: instanteClinica(d.fecha, d.fin) } }
export const ocupaAgenda = (cita: IntervaloAgenda) => !['cancelada_paciente', 'cancelada_medico', 'no_asistio', 'cancelada'].includes(cita.estado ?? '')
export const seCruzan = (a: IntervaloAgenda, b: IntervaloAgenda) => Date.parse(a.inicio) < Date.parse(b.fin) && Date.parse(a.fin) > Date.parse(b.inicio)
function longitudUnion(intervalos: [number, number][]): number { let total = 0, fin = -Infinity; for (const [a, b] of intervalos.sort((x, y) => x[0] - y[0])) { if (b > fin) total += b - Math.max(a, fin); fin = Math.max(fin, b) }; return total / 60000 }
export function resumirAgenda(bloques: BloqueAgenda[], citas: IntervaloAgenda[], fecha: string, duracion: number, ahora = new Date(), cantidad = 7, descansos: DescansoAgenda[] = []): ResumenAgenda {
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 240) throw Error('El médico no tiene una duración de consulta válida.')
  const vigentes = citas.filter(ocupaAgenda), pausas = descansos.map(intervaloDescanso), dias: ResumenAgenda['dias'] = []
  let jornadaMinutos = 0, ocupadosMinutos = 0
  for (let d = 0; d < cantidad; d++) {
    const dia = sumarDias(fecha, d), semana = new Date(dia + 'T12:00:00Z').getUTCDay(), slots: TurnoAgenda[] = [], intersecciones: [number, number][] = []
    for (const b of bloques.filter((b) => b.dia === semana)) {
      const inicioBloque = instanteClinica(dia, b.inicio), finBloque = instanteClinica(dia, b.fin)
      if (d === 0) {
        let segmentos: [number, number][] = [[Date.parse(inicioBloque), Date.parse(finBloque)]]
        for (const pausa of pausas) segmentos = segmentos.flatMap(([a, b]) => { const x = Date.parse(pausa.inicio), y = Date.parse(pausa.fin); if (x >= b || y <= a) return [[a, b]] as [number, number][]; const nuevos: [number, number][] = []; if (x > a) nuevos.push([a, x]); if (y < b) nuevos.push([y, b]); return nuevos })
        jornadaMinutos += segmentos.reduce((n, [a, b]) => n + (b - a) / 60000, 0)
        for (const [a, b] of segmentos) for (const c of vigentes) { const x = Math.max(Date.parse(c.inicio), a), y = Math.min(Date.parse(c.fin), b); if (y > x) intersecciones.push([x, y]) }
      }
      for (let min = minutosHora(b.inicio); min + duracion <= minutosHora(b.fin); min += b.paso ?? duracion) {
        const hhmm = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
        const inicio = instanteClinica(dia, hhmm), fin = new Date(Date.parse(inicio) + duracion * 60000).toISOString()
        if (Date.parse(inicio) <= ahora.getTime() || [...vigentes, ...pausas].some((c) => seCruzan(c, { inicio, fin }))) continue
        slots.push({ inicio, fin, hora: horaClinica(inicio), finHora: horaClinica(fin) })
      }
    }
    if (d === 0) ocupadosMinutos = longitudUnion(intersecciones)
    dias.push({ fecha: dia, slots })
  }
  return { configurado: bloques.length > 0, bloques, descansos, duracionConsulta: duracion, dias, jornadaMinutos, ocupadosMinutos, proximo: dias.flatMap((d) => d.slots)[0] ?? null, proximaCita: vigentes.filter((c) => Date.parse(c.inicio) > ahora.getTime()).sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null, actualizado: ahora.toISOString() }
}
export async function leerAgendaMedico(id: number, fecha = fechaClinica()): Promise<ResumenAgenda> { const r = await fetch(`/api/agenda/${id}?fecha=${fecha}`, { cache: 'no-store' }); const body = await r.json(); if (!r.ok) throw Error(body.error || 'No se pudo consultar la agenda.'); return body }
