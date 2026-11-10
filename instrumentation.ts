import type { Instrumentation } from 'next'
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // No registrar cabeceras, cookies, consultas, cuerpos, nombres ni texto clínico.
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : null
  console.error(JSON.stringify({ evento: 'error_servidor', fecha: new Date().toISOString(), ruta: context.routePath, metodo: request.method, digest }))
}
