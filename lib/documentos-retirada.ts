type ErrorOperacion = { code?: string; message?: string }
/** Retira el archivo de su ubicación accesible y conserva una copia privada. */
export async function retirarPdfConCopia(storage: any, bucket: string, ruta: string, registrar: () => PromiseLike<{ error: ErrorOperacion | null }>): Promise<{ ok: true } | { ok: false; status: number; mensaje: string }> {
  const copia = `retirados/${crypto.randomUUID()}/${ruta}`
  const movido = await storage.from(bucket).move(ruta, copia)
  if (movido.error) return { ok: false, status: 409, mensaje: 'No se pudo retirar el PDF. Puede haber cambiado; actualiza el documento antes de reintentar.' }
  let error: ErrorOperacion | null
  try { error = (await registrar()).error } catch { error = { code: 'RED' } }
  if (!error) return { ok: true }
  const restaurado = await storage.from(bucket).move(copia, ruta)
  if (restaurado.error) return { ok: false, status: 503, mensaje: 'El PDF se retiró y conserva una copia privada, pero no se pudo completar el registro de la operación. Contacta con administración antes de reintentar.' }
  return { ok: false, status: error.code === '42501' ? 403 : error.code === '40001' ? 409 : 503, mensaje: error.code === '40001' ? 'El documento cambió. Se conservó el PDF original; actualiza antes de eliminar.' : 'No se pudo registrar la eliminación. El PDF original se conservó; puedes reintentar.' }
}
