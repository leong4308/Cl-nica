export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const BUCKET_LABORATORIO = 'resultados-laboratorio'

export async function validarPdf(archivo: File): Promise<string | null> {
  if (!/\.pdf$/i.test(archivo.name) || (archivo.type && archivo.type !== 'application/pdf')) {
    return 'Selecciona un archivo PDF.'
  }
  if (archivo.size === 0) return 'El PDF está vacío.'
  if (archivo.size > MAX_PDF_BYTES) return 'El PDF debe pesar como máximo 10 MB.'
  const cabecera = new TextDecoder().decode(await archivo.slice(0, 5).arrayBuffer())
  if (cabecera !== '%PDF-') return 'El archivo no contiene un PDF válido.'
  return null
}

export function nombrePdf(ruta: string): string {
  return (ruta.split('/').pop() || 'Resultado.pdf').replace(/^[a-f0-9-]{36}-/i, '')
}
