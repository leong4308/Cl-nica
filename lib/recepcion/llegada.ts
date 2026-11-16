/** La llegada administrativa conserva el estado clínico de la consulta. */
export async function registrarLlegadaCita(citaId: number): Promise<string | null> {
  try {
    const consulta = await fetch(`/api/recepcion?cita=${citaId}`, { cache: 'no-store' })
    const estado = await consulta.json()
    if (!consulta.ok) throw Error(estado.error || 'No se pudo verificar la cita.')
    const respuesta = await fetch('/api/recepcion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId, version: estado.version, accion: 'llegada', clave: crypto.randomUUID() }) })
    const resultado = await respuesta.json()
    if (!respuesta.ok) throw Error(resultado.error || 'No se pudo registrar la llegada.')
    window.dispatchEvent(new Event('datos-actualizados'))
    return null
  } catch (error) { return (error as Error).message || 'No se pudo registrar la llegada.' }
}
