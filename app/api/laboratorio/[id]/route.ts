import { errorOperacion } from '@/lib/supabase/error-operacion'
import { autorizarRegistro } from '@/lib/pacientes/acceso'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { BUCKET_LABORATORIO, MAX_PDF_BYTES, validarPdf } from '@/lib/laboratorio/archivo-pdf'

type Contexto = { params: Promise<{ id: string }> }
const fallo = (error: string, status: number) => NextResponse.json({ error }, { status })

function clienteArchivos() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('El almacenamiento de PDF no está configurado en el servidor.')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function autorizar(idTexto: string) {
  const id = Number(idTexto)
  if (!Number.isSafeInteger(id) || id <= 0) return { respuesta: fallo('Solicitud inválida.', 400) } as const
  const db = await createClient()
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) return { respuesta: fallo('Inicia sesión para continuar.', 401) } as const
  const { data: perfil, error: errorPerfil } = await db.from('usuarios').select('id, rol, esta_activo').eq('auth_user_id', user.id).maybeSingle()
  if (errorPerfil || !perfil?.esta_activo || !['admin', 'medico', 'enfermero'].includes(perfil.rol)) return { respuesta: fallo('No tienes permiso para acceder a los resultados de laboratorio.', 403) } as const
  const denegado = await autorizarRegistro(db, 'laboratorio', id, perfil)
  if (denegado) return { respuesta: denegado } as const
  // La consulta y la actualización usan la sesión del usuario y sus políticas RLS.
  const { data: solicitud, error } = await db.from('solicitudes_analisis')
    .select('id, archivo_resultado, estado_analisis, fecha_resultado').eq('id', id).maybeSingle()
  if (error) return { respuesta: fallo('No se pudo consultar la solicitud.', 500) } as const
  if (!solicitud) return { respuesta: fallo('Solicitud no encontrada o sin acceso.', 404) } as const
  return { db, user, solicitud, id } as const
}

// Acceso al PDF de la solicitud; nunca se acepta una ruta enviada por el navegador.
export async function GET(_request: Request, { params }: Contexto) {
  try {
    const acceso = await autorizar((await params).id)
    if ('respuesta' in acceso) return acceso.respuesta
    const ruta = acceso.solicitud.archivo_resultado
    if (!ruta || !ruta.startsWith(`${acceso.id}/`) || ruta.includes('..')) return fallo('Esta solicitud no tiene un PDF disponible.', 404)
    const admin = clienteArchivos()
    const { data, error } = await admin.storage.from(BUCKET_LABORATORIO).createSignedUrl(ruta, 300)
    if (error || !data) return fallo('No se pudo abrir el PDF. Inténtalo de nuevo.', 500)
    const auditoria = await acceso.db.rpc('clinica_auditar_documento', { p_tipo: 'laboratorio', p_id: acceso.id, p_accion: 'ABRIR_DOCUMENTO', p_nombre: ruta.split('/').pop() })
    if (auditoria.error) return errorOperacion(auditoria.error)
    const respuesta = NextResponse.redirect(data.signedUrl)
    respuesta.headers.set('Cache-Control', 'private, no-store')
    respuesta.headers.set('Referrer-Policy', 'no-referrer')
    return respuesta
  } catch (error) {
    return fallo(error instanceof Error ? error.message : 'No se pudo abrir el PDF.', 500)
  }
}

export async function POST(request: Request, { params }: Contexto) {
  let rutaNueva: string | undefined
  let admin: ReturnType<typeof clienteArchivos> | undefined
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) return fallo('Origen de solicitud inválido.', 403)
    const acceso = await autorizar((await params).id)
    if ('respuesta' in acceso) return acceso.respuesta
    const { db, solicitud, id } = acceso
    if (Number(request.headers.get('content-length')) > MAX_PDF_BYTES + 1024 * 1024) return fallo('La solicitud supera el tamaño permitido.', 413)
    const form = await request.formData()
    const resultado = String(form.get('resultado') ?? '').trim()
    const observaciones = String(form.get('observaciones') ?? '').trim()
    const estado = String(form.get('estado') ?? 'completado')
    if (!['completado', 'en proceso'].includes(estado)) return fallo('Estado de resultado inválido.', 400)
    if (solicitud.estado_analisis === 'completado' && form.get('confirmarCompletado') !== 'true') return fallo('Confirma la advertencia antes de modificar un resultado completado.', 400)
    if (String(form.get('version') ?? '') !== (solicitud.fecha_resultado ?? '')) return fallo('El resultado cambió desde que lo abriste. Cierra y vuelve a abrir la solicitud para revisar la versión actual.', 409)
    const archivo = form.get('archivo')
    if (archivo !== null && !(archivo instanceof File)) return fallo('Selecciona un archivo PDF.', 400)
    if (!resultado && !archivo && !solicitud.archivo_resultado) return fallo('Escribe el resultado o adjunta un PDF.', 400)
    if (archivo instanceof File) {
      const errorPdf = await validarPdf(archivo)
      if (errorPdf) return fallo(errorPdf, 400)
      admin = clienteArchivos()
      const { data: bucket, error: errorBucket } = await admin.storage.getBucket(BUCKET_LABORATORIO)
      if (bucket?.public) return fallo('El almacenamiento de resultados debe ser privado.', 500)
      if (!bucket) {
        if (errorBucket && !['400', '404'].includes(String(errorBucket.statusCode))) return fallo('No se pudo consultar el almacenamiento de PDF.', 500)
        const { error } = await admin.storage.createBucket(BUCKET_LABORATORIO, {
          public: false, allowedMimeTypes: ['application/pdf'], fileSizeLimit: MAX_PDF_BYTES,
        })
        // Otro guardado puede haber creado el bucket al mismo tiempo.
        if (error) {
          const { data: creado } = await admin.storage.getBucket(BUCKET_LABORATORIO)
          if (!creado || creado.public) return fallo('No se pudo preparar el almacenamiento de PDF.', 500)
        }
      }
      const nombre = archivo.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
      const ruta = `${id}/${crypto.randomUUID()}-${nombre}`
      const { error } = await admin.storage.from(BUCKET_LABORATORIO).upload(ruta, archivo, { contentType: 'application/pdf', upsert: false })
      if (error) return fallo('No se pudo subir el PDF. El resultado no se modificó.', 500)
      rutaNueva = ruta
    }
    const cambios = {
      resultado: resultado || null,
      observaciones: observaciones || null,
      estado_analisis: estado,
      ...(estado === 'completado' ? { fecha_resultado: new Date().toISOString() } : {}),
      ...(rutaNueva ? { archivo_resultado: rutaNueva } : {}),
    }
    let consulta = db.from('solicitudes_analisis').update(cambios).eq('id', id).eq('estado_analisis', solicitud.estado_analisis)
    consulta = solicitud.fecha_resultado ? consulta.eq('fecha_resultado', solicitud.fecha_resultado) : consulta.is('fecha_resultado', null)
    const { data: actualizado, error } = await consulta.select('id').maybeSingle()
    if (error || !actualizado) {
      if (rutaNueva && admin) await admin.storage.from(BUCKET_LABORATORIO).remove([rutaNueva])
      rutaNueva = undefined
      return fallo(error ? 'No se pudo guardar el resultado. Revisa tus permisos e inténtalo de nuevo.' : 'El resultado cambió o no tienes permiso para modificarlo. Vuelve a abrir la solicitud.', 409)
    }
    // El archivo anterior se conserva hasta que la actualización haya terminado.
    rutaNueva = undefined
    // El PDF previo permanece privado para que auditoría y respaldos puedan conservar su versión.
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (rutaNueva && admin) await admin.storage.from(BUCKET_LABORATORIO).remove([rutaNueva]).catch(() => {})
    return fallo(error instanceof Error ? error.message : 'No se pudo guardar el resultado.', 500)
  }
}
