'use client'

import { useEffect, useId, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Droplet, Heart, Loader2, Pencil, Pill, Save, Scale, ShieldAlert, Thermometer, Wind } from 'lucide-react'
import { guardarFichaImportante, type FichaImportante } from '@/lib/supabase/datos'
import { leerFichaClinica, type SeccionFichaClinica } from '@/lib/pacientes/ficha-clinica'
import { createClient } from '@/lib/supabase/client'
import { leerPerfilPacienteEnCache, registrarPerfilPacienteEnCache } from '@/lib/supabase/cache-pacientes'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '../compartidos/editor-clinico'

type Props = {
  pacienteId: number
  notasMedicasRaw?: string
  rol?: RolUsuario
  usuarioNombre?: string
  onActualizado?: (ficha: FichaImportante) => void
  modoCompacto?: boolean
  solicitudEdicion?: number
  onEditandoChange?: (editando: boolean) => void
  onGuardandoChange?: (guardando: boolean) => void
}
const GRUPOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const SIGNOS = [
  { campo: 'presionArterial', titulo: 'Presión arterial', unidad: 'mmHg', icon: Heart },
  { campo: 'frecuenciaCardiaca', titulo: 'Frecuencia cardíaca', unidad: 'lpm', icon: Activity },
  { campo: 'temperatura', titulo: 'Temperatura', unidad: '°C', icon: Thermometer },
  { campo: 'saturacionOxigeno', titulo: 'Saturación de oxígeno', unidad: '%', icon: Wind },
  { campo: 'peso', titulo: 'Peso', unidad: 'kg', icon: Scale },
  { campo: 'glucosa', titulo: 'Glucosa', unidad: 'mg/dL', icon: Droplet },
] as const

export function FichaImportantePaciente({ pacienteId, notasMedicasRaw, rol, onActualizado, solicitudEdicion = 0, onEditandoChange, onGuardandoChange }: Props) {
  const [ficha, setFicha] = useState<FichaImportante>(() => leerFichaClinica(notasMedicasRaw))
  const [borrador, setBorrador] = useState<FichaImportante>({})
  const [seccion, setSeccion] = useState<'alertas' | 'signos' | null>(null)
  const [rolSesion, setRolSesion] = useState(rol)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState<string | null>(null)
  const prefijo = useId()
  const puedeEditar = ['admin', 'medico', 'enfermero', 'recepcionista'].includes(rol ?? rolSesion ?? '')

  useEffect(() => { setFicha(leerFichaClinica(notasMedicasRaw)) }, [notasMedicasRaw])
  useEffect(() => {
    if (rol) { setRolSesion(rol); return }
    let vigente = true
    const db = createClient()
    db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await db.from('usuarios').select('rol').eq('auth_user_id', user.id).maybeSingle()
      if (vigente && data) setRolSesion(data.rol as RolUsuario)
    }).catch(() => {})
    return () => { vigente = false }
  }, [rol])
  useEffect(() => { onEditandoChange?.(seccion !== null) }, [seccion, onEditandoChange])
  useEffect(() => { onGuardandoChange?.(guardando) }, [guardando, onGuardandoChange])
  useEffect(() => {
    if (solicitudEdicion > 0) abrirEdicion('alertas')
  }, [solicitudEdicion])

  function abrirEdicion(destino: 'alertas' | 'signos') {
    if (!puedeEditar || guardando) return
    setBorrador({ ...ficha, signosVitales: { ...ficha.signosVitales } })
    setSeccion(destino)
    setError(null)
    setMensaje('')
  }
  function cambiarAlerta(campo: 'alergias' | 'tipoSangre' | 'condicionesCronicas' | 'medicamentoActual', valor: string) {
    setBorrador((prev) => ({ ...prev, [campo]: valor }))
  }
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (!seccion || guardando || !puedeEditar) return
    setGuardando(true)
    setError(null)
    try {
      const cambios: FichaImportante = seccion === 'alertas'
        ? { alergias: borrador.alergias ?? '', tipoSangre: borrador.tipoSangre ?? '', condicionesCronicas: borrador.condicionesCronicas ?? '', medicamentoActual: borrador.medicamentoActual ?? '' }
        : { signosVitales: borrador.signosVitales }
      const resultado = await guardarFichaImportante(pacienteId, cambios, seccion as SeccionFichaClinica)
      if (!resultado.ok || !resultado.ficha) { setError(resultado.error || 'No se pudo guardar la información.'); return }
      const actualizada = resultado.ficha
      setFicha(actualizada)
      const perfil = leerPerfilPacienteEnCache(pacienteId)
      if (perfil) registrarPerfilPacienteEnCache({ ...perfil, notasMedicas: JSON.stringify(actualizada) })
      onActualizado?.(actualizada)
      setMensaje(seccion === 'alertas' ? 'Alertas y antecedentes guardados correctamente.' : 'Signos vitales guardados correctamente.')
      setSeccion(null)
      window.dispatchEvent(new Event('datos-actualizados'))
    } finally { setGuardando(false) }
  }
  const signos = ficha.signosVitales
  const haySignos = SIGNOS.some(({ campo }) => signos?.[campo])
  const fechaSignos = signos?.fechaHora && !Number.isNaN(Date.parse(signos.fechaHora))
    ? new Date(signos.fechaHora).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' })
    : signos?.fechaHora

  return <div className="space-y-5">
    {mensaje && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" />{mensaje}</p>}
    <AvisoClinico mensaje={error} />
    {seccion ? <form onSubmit={guardar} aria-label={seccion === 'alertas' ? 'Editar alertas y antecedentes' : 'Registrar signos vitales'} className="rounded-2xl border border-blue-200 bg-white p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
        <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600">{seccion === 'alertas' ? <ShieldAlert size={20} /> : <Activity size={20} />}</span>
        <div><h4 className="text-base font-semibold text-slate-900">{seccion === 'alertas' ? 'Editar alertas y antecedentes' : 'Registrar signos vitales'}</h4><p className="mt-1 text-sm leading-relaxed text-slate-500">{seccion === 'alertas' ? 'Actualiza la información clínica relevante del paciente.' : 'Captura los valores obtenidos durante la atención.'}</p></div>
      </div>
      <fieldset disabled={guardando} className="min-w-0 space-y-5">
        {seccion === 'alertas' ? <>
          <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className={ETIQUETA_CLINICA}>Alergias conocidas<textarea rows={3} maxLength={4000} className={CAMPO_CLINICO + ' resize-y'} value={borrador.alergias ?? ''} onChange={(e) => cambiarAlerta('alergias', e.target.value)} placeholder="Alergias y reacciones registradas..." /></label>
            <label className={ETIQUETA_CLINICA}>Grupo sanguíneo<select className={CAMPO_CLINICO} value={borrador.tipoSangre ?? ''} onChange={(e) => cambiarAlerta('tipoSangre', e.target.value)}><option value="">No registrado</option>{borrador.tipoSangre && !GRUPOS.includes(borrador.tipoSangre) && <option value={borrador.tipoSangre}>{borrador.tipoSangre}</option>}{GRUPOS.map((grupo) => <option key={grupo}>{grupo}</option>)}</select></label>
          </div>
          <label className={ETIQUETA_CLINICA}>Padecimientos crónicos y antecedentes<textarea rows={3} maxLength={4000} className={CAMPO_CLINICO + ' resize-y'} value={borrador.condicionesCronicas ?? ''} onChange={(e) => cambiarAlerta('condicionesCronicas', e.target.value)} placeholder="Condiciones y antecedentes relevantes..." /></label>
          <label className={ETIQUETA_CLINICA}>Medicamentos o tratamiento actual<textarea rows={3} maxLength={4000} className={CAMPO_CLINICO + ' resize-y'} value={borrador.medicamentoActual ?? ''} onChange={(e) => cambiarAlerta('medicamentoActual', e.target.value)} placeholder="Tratamiento que el paciente tiene registrado..." /></label>
        </> : <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">{SIGNOS.map(({ campo, titulo, unidad }) => <label key={campo} className={ETIQUETA_CLINICA} htmlFor={`${prefijo}-${campo}`}>{titulo} <span className="text-xs font-normal text-slate-500">({unidad})</span><input id={`${prefijo}-${campo}`} type="text" inputMode={campo === 'presionArterial' ? 'text' : 'decimal'} className={CAMPO_CLINICO} maxLength={40} value={borrador.signosVitales?.[campo] ?? ''} onChange={(e) => setBorrador((prev) => ({ ...prev, signosVitales: { ...prev.signosVitales, [campo]: e.target.value } }))} /></label>)}</div>}
      </fieldset>
      <div className="sticky bottom-0 mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-white pt-4">
        <button type="button" className={BOTON_SECUNDARIO} disabled={guardando} onClick={() => { setSeccion(null); setError(null) }}>Cancelar edición</button>
        <button key="guardar-ficha" type="submit" className={BOTON_PRIMARIO} disabled={guardando}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{guardando ? 'Guardando...' : seccion === 'alertas' ? 'Guardar alertas' : 'Guardar signos vitales'}</button>
      </div>
    </form> : <>
      <section aria-label="Alertas y antecedentes" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><ShieldAlert size={20} /></span><div><h4 className="text-base font-semibold text-slate-900">Alertas y antecedentes</h4><p className="mt-1 text-xs text-slate-500">Información relevante para la atención.</p></div></div>{puedeEditar && <button key="editar-alertas" type="button" onClick={(event) => { event.preventDefault(); abrirEdicion('alertas') }} className={BOTON_SECUNDARIO}><Pencil size={15} />Editar alertas</button>}</div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/60 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-amber-800"><AlertTriangle size={15} />Alergias</p><p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-slate-800">{ficha.alergias || 'No registradas'}</p></div>
          <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-blue-700"><Droplet size={15} />Grupo sanguíneo</p><p className="mt-3 break-words text-xl font-semibold text-slate-900">{ficha.tipoSangre || 'No registrado'}</p></div>
          <div className="min-w-0 rounded-xl border border-violet-100 bg-violet-50/60 p-4"><p className="text-xs font-semibold text-violet-700">Padecimientos crónicos</p><p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-slate-800">{ficha.condicionesCronicas || 'No registrados'}</p></div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Pill size={15} className="text-emerald-600" />Medicamentos o tratamiento actual</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{ficha.medicamentoActual || 'Sin información registrada.'}</p></div>
      </section>
      <section aria-label="Signos vitales" className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><Activity size={20} /></span><div><h4 className="text-base font-semibold text-slate-900">Signos vitales</h4><p className="mt-1 text-xs text-slate-500">{fechaSignos || 'Aún no se han registrado mediciones.'}</p></div></div>{puedeEditar && <button key="editar-signos" type="button" onClick={(event) => { event.preventDefault(); abrirEdicion('signos') }} className={BOTON_SECUNDARIO}><Activity size={15} />{haySignos ? 'Actualizar signos vitales' : 'Tomar signos vitales'}</button>}</div>
        {haySignos ? <><div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">{SIGNOS.map(({ campo, titulo, unidad, icon: Icon }) => <div key={campo} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5"><p className="flex items-center gap-2 text-xs text-slate-500"><Icon size={14} className="shrink-0 text-teal-600" />{titulo}</p><p className="mt-3 break-words text-xl font-semibold text-slate-900">{signos?.[campo] || '—'} <span className="text-xs font-normal text-slate-500">{unidad}</span></p></div>)}</div>{signos?.tomadoPor && <p className="mt-3 text-xs text-slate-500">Registrado por: <span className="font-medium text-slate-700">{signos.tomadoPor}</span></p>}</> : <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">Las mediciones aparecerán aquí cuando se capture el primer registro.</p>}
      </section>
    </>}
  </div>
}
