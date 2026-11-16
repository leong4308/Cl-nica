export type HabitacionCatalogo = { id: number; clinicaId: number; numero: string; tipo: string; capacidad: number; activa: boolean; motivo: string | null; habilitadas: number; version: string }
export type CamaCatalogo = { id: number; habitacionId: number; numero: string; habilitada: boolean; motivo: string | null; ocupada: boolean; version: string }
export type CatalogoCamas = { clinicas: { id: number; nombre: string; activa: boolean }[]; habitaciones: HabitacionCatalogo[]; camas: CamaCatalogo[] }
export const disponibleCama = (c: { ocupada: boolean; habilitada?: boolean }) => !c.ocupada && c.habilitada !== false
export async function consultarCatalogo(signal?: AbortSignal): Promise<CatalogoCamas> {
  const r = await fetch('/api/admin/camas', { cache: 'no-store', signal }), b = await r.json()
  if (!r.ok) throw Error(b.error || 'No se pudo consultar el catálogo de camas.')
  return b
}
export async function guardarCatalogo(accion: string, datos: Record<string, unknown>, clave: string) {
  const r = await fetch('/api/admin/camas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, datos, clave }) }), b = await r.json()
  if (!r.ok) throw Error(b.error || 'No se pudo guardar el recurso.')
  return b as { id: number; mensaje: string }
}
