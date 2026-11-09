import { NextResponse } from 'next/server'
import { cuentaAutenticada, origenValido } from '@/lib/cuenta/servidor'
import { normalizarPreferencias } from '@/lib/cuenta/preferencias'
import { validarNombreTelefono } from '@/lib/cuenta/validacion'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

export async function GET() {
  try {
    const acceso = await cuentaAutenticada()
    if ('respuesta' in acceso) return acceso.respuesta
    const { db, user, usuario } = acceso
    const { data } = await db.auth.getClaims()
    let especialidad: string | null = null
    if (usuario.rol === 'medico') {
      const { data: medico } = await db.from('perfiles_medicos').select('especialidad').eq('usuario_id', usuario.id).maybeSingle()
      especialidad = medico?.especialidad ?? null
    }
    let clinicaId: number | undefined
    if (usuario.rol === 'medico' || usuario.rol === 'enfermero') {
      const { data: profesional } = await db.from(usuario.rol === 'medico' ? 'perfiles_medicos' : 'perfiles_enfermeros').select('clinica_id').eq('usuario_id', usuario.id).maybeSingle()
      clinicaId = profesional?.clinica_id
    }
    let consultaClinica = db.from('clinicas').select('nombre, telefono, correo_contacto').eq('esta_activo', true)
    if (clinicaId) consultaClinica = consultaClinica.eq('id', clinicaId)
    const { data: soporte } = await consultaClinica.limit(1).maybeSingle()
    return NextResponse.json({ cuenta: { nombre: usuario.nombre_completo, correo: user.email ?? usuario.correo, telefono: usuario.telefono ?? '', rol: usuario.rol, especialidad, creado: usuario.creado_en, preferencias: normalizarPreferencias(user.user_metadata?.clinica_preferencias, usuario.rol as RolUsuario), sesion: { jwtVerificado: Boolean(data?.claims), expira: data?.claims.exp ?? null }, soporte } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return NextResponse.json({ error: 'No se pudo cargar tu cuenta.' }, { status: 500 }) }
}

export async function PATCH(request: Request) {
  try {
    if (!origenValido(request)) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
    const acceso = await cuentaAutenticada()
    if ('respuesta' in acceso) return acceso.respuesta
    const { db, user, usuario } = acceso
    const body = await request.json()
    if (body.accion === 'perfil') {
      const errorCampos = validarNombreTelefono(body.nombre, body.telefono)
      if (errorCampos) return NextResponse.json({ error: errorCampos }, { status: 400 })
      const { data, error } = await db.from('usuarios').update({ nombre_completo: body.nombre.trim(), telefono: body.telefono?.trim() || null }).eq('auth_user_id', user.id).select('id').maybeSingle()
      if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar tu perfil.' }, { status: 400 })
      return NextResponse.json({ ok: true })
    }
    if (body.accion === 'preferencias') {
      const preferencias = normalizarPreferencias(body.preferencias, usuario.rol as RolUsuario)
      const { error } = await db.auth.updateUser({ data: { clinica_preferencias: preferencias } })
      if (error) return NextResponse.json({ error: 'No se pudieron guardar tus preferencias.' }, { status: 400 })
      return NextResponse.json({ ok: true, preferencias })
    }
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  } catch { return NextResponse.json({ error: 'No se pudo guardar la información de tu cuenta.' }, { status: 500 }) }
}
