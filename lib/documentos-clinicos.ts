import { validarPdf } from './laboratorio/archivo-pdf'

export const LIMITE_PDF_CLINICO = 2 * 1024 * 1024
export const BUCKET_DOCUMENTOS_CLINICOS = 'documentos-clinicos'
export type TipoDocumentoClinico = 'expedientes' | 'ordenes'
export const validarDocumentoClinico = (archivo: File) => validarPdf(archivo, LIMITE_PDF_CLINICO)

export async function subirDocumentoClinico(tipo: TipoDocumentoClinico, id: number, archivo: File): Promise<string | null> {
  try {
    const error = await validarDocumentoClinico(archivo)
    if (error) return error
    const form = new FormData()
    form.set('archivo', archivo)
    const respuesta = await fetch(`/api/documentos-clinicos/${tipo}/${id}`, { method: 'POST', body: form })
    const datos = await respuesta.json()
    return respuesta.ok ? null : datos.error || 'No se pudo adjuntar el PDF.'
  } catch { return 'No se pudo conectar para adjuntar el PDF. Inténtalo de nuevo.' }
}
