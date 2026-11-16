import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cuentaAutenticada } from '@/lib/cuenta/servidor'
import { errorOperacion } from '@/lib/supabase/error-operacion'
import { BUCKET_DOCUMENTOS_CLINICOS } from '@/lib/documentos-clinicos'
import { BUCKET_LABORATORIO, nombrePdf } from '@/lib/laboratorio/archivo-pdf'

export async function GET(request: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const a = await cuentaAutenticada()
  if (a.respuesta) return a.respuesta
  if (a.usuario.rol !== 'paciente') return NextResponse.json({ error: 'Acceso exclusivo del paciente.' }, { status: 403 })
  const { tipo, id: textoId } = await params, id = Number(textoId)
  if (!['expedientes', 'laboratorio'].includes(tipo) || !Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Documento inválido.' }, { status: 400 })
  const r = tipo === 'expedientes'
    ? await a.db.from('expedientes').select('id').eq('id', id).maybeSingle()
    : await a.db.from('solicitudes_analisis').select('id,archivo_resultado,estado_analisis').eq('id', id).eq('estado_analisis', 'completado').maybeSingle()
  if (r.error) return errorOperacion(r.error)
  if (!r.data) return NextResponse.json({ error: 'Documento no disponible o sin acceso.' }, { status: 404 })
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }).storage
  const archivo = new URL(request.url).searchParams.get('archivo')
  let ruta: string | undefined, bucket = BUCKET_DOCUMENTOS_CLINICOS
  if (tipo === 'laboratorio') {
    ruta = (r.data as { archivo_resultado?: string }).archivo_resultado
    bucket = BUCKET_LABORATORIO
    if (!ruta?.startsWith(`${id}/`) || ruta.includes('..')) return NextResponse.json({ error: 'No hay PDF disponible.' }, { status: 404 })
  } else if (!archivo) {
    const lista = await storage.from(bucket).list(`expedientes/${id}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    if (lista.error) return NextResponse.json({ error: 'No se pudieron consultar los documentos.' }, { status: 503 })
    return NextResponse.json({ archivos: lista.data.filter(f => /\.pdf$/i.test(f.name)).map(f => ({ nombre: nombrePdf(f.name), href: `/api/portal-paciente/documentos/expedientes/${id}?archivo=${encodeURIComponent(f.name)}` })) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } else {
    if (!/^[a-zA-Z0-9._-]+\.pdf$/i.test(archivo) || archivo.includes('..')) return NextResponse.json({ error: 'Documento inválido.' }, { status: 400 })
    ruta = `expedientes/${id}/${archivo}`
  }
  const url = await storage.from(bucket).createSignedUrl(ruta, 300)
  if (url.error || !url.data) return NextResponse.json({ error: 'No se pudo abrir el documento.' }, { status: 404 })
  const audit = await a.db.rpc('clinica_auditar_documento', { p_tipo: tipo, p_id: id, p_accion: 'ABRIR_DOCUMENTO', p_nombre: ruta.split('/').pop() })
  if (audit.error) return errorOperacion(audit.error)
  const respuesta = NextResponse.redirect(url.data.signedUrl)
  respuesta.headers.set('Cache-Control', 'private, no-store'); respuesta.headers.set('Referrer-Policy', 'no-referrer')
  return respuesta
}
