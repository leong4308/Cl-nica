import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { BUCKET_DOCUMENTOS_CLINICOS, LIMITE_PDF_CLINICO, validarDocumentoClinico } from '@/lib/documentos-clinicos'
import { nombrePdf } from '@/lib/laboratorio/archivo-pdf'

type Contexto = { params: Promise<{ tipo: string; id: string }> }
const fallo = (error: string, status: number) => NextResponse.json({ error }, { status })
async function autorizar(contexto: Contexto, escritura = false) {
  const { tipo, id: textoId } = await contexto.params
  const id = Number(textoId)
  if (!['expedientes', 'ordenes'].includes(tipo) || !Number.isSafeInteger(id) || id <= 0) return { respuesta: fallo('Registro inválido.', 400) } as const
  const db = await createClient()
  const { data: { user }, error: errorSesion } = await db.auth.getUser()
  if (!user || errorSesion) return { respuesta: fallo('Inicia sesión para consultar documentos.', 401) } as const
  const { data: perfil } = await db.from('usuarios').select('rol, esta_activo').eq('auth_user_id', user.id).maybeSingle()
  const roles = tipo === 'expedientes' ? (escritura ? ['admin', 'medico'] : ['admin', 'medico', 'recepcionista']) : ['admin', 'medico', 'enfermero']
  if (!perfil?.esta_activo || !roles.includes(perfil.rol)) return { respuesta: fallo('No tienes permiso para acceder a estos documentos.', 403) } as const
  const { data, error } = await db.from(tipo === 'expedientes' ? 'expedientes' : 'ordenes_medicas').select('id').eq('id', id).maybeSingle()
  if (error) return { respuesta: fallo('No se pudo consultar el registro.', 500) } as const
  if (!data) return { respuesta: fallo('Registro no encontrado o sin acceso.', 404) } as const
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { respuesta: fallo('El almacenamiento de documentos no está configurado.', 500) } as const
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return { tipo, id, prefijo: `${tipo}/${id}`, storage: admin.storage } as const
}

export async function GET(request: Request, contexto: Contexto) {
  try {
    const acceso = await autorizar(contexto)
    if ('respuesta' in acceso) return acceso.respuesta
    const { storage, prefijo, tipo, id } = acceso
    const archivo = new URL(request.url).searchParams.get('archivo')
    if (archivo) {
      if (!/^[a-zA-Z0-9._-]+\.pdf$/i.test(archivo) || archivo.includes('..')) return fallo('Documento inválido.', 400)
      const { data, error } = await storage.from(BUCKET_DOCUMENTOS_CLINICOS).createSignedUrl(`${prefijo}/${archivo}`, 300)
      if (error || !data) return fallo('No se pudo abrir el documento.', 404)
      const respuesta = NextResponse.redirect(data.signedUrl)
      respuesta.headers.set('Cache-Control', 'private, no-store')
      respuesta.headers.set('Referrer-Policy', 'no-referrer')
      return respuesta
    }
    const { data, error } = await storage.from(BUCKET_DOCUMENTOS_CLINICOS).list(prefijo, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    if (error) return fallo('No se pudieron consultar los documentos adjuntos.', 500)
    return NextResponse.json({ archivos: (data ?? []).filter((f) => /\.pdf$/i.test(f.name)).map((f) => ({ nombre: nombrePdf(f.name), href: `/api/documentos-clinicos/${tipo}/${id}?archivo=${encodeURIComponent(f.name)}` })) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return fallo('No se pudo conectar con el almacenamiento de documentos.', 500) }
}

export async function POST(request: Request, contexto: Contexto) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) return fallo('Origen de solicitud inválido.', 403)
    const acceso = await autorizar(contexto, true)
    if ('respuesta' in acceso) return acceso.respuesta
    if (Number(request.headers.get('content-length')) > LIMITE_PDF_CLINICO + 1024 * 1024) return fallo('El PDF debe pesar como máximo 2 MB.', 413)
    const archivo = (await request.formData()).get('archivo')
    if (!(archivo instanceof File)) return fallo('Selecciona un archivo PDF.', 400)
    const errorArchivo = await validarDocumentoClinico(archivo)
    if (errorArchivo) return fallo(errorArchivo, 400)
    const nombre = archivo.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '-').slice(-100)
    const ruta = `${acceso.prefijo}/${crypto.randomUUID()}-${nombre}`
    const { error } = await acceso.storage.from(BUCKET_DOCUMENTOS_CLINICOS).upload(ruta, archivo, { contentType: 'application/pdf', upsert: false })
    if (error) return fallo('No se pudo adjuntar el PDF. Inténtalo de nuevo.', 500)
    return NextResponse.json({ ok: true })
  } catch { return fallo('No se pudo conectar para adjuntar el PDF.', 500) }
}
