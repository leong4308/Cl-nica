'use client'
import { useEffect, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, ETIQUETA_CLINICA } from '../compartidos/editor-clinico'
type Medico = { id: number; nombre: string; especialidad: string }
export function MedicosTratantes({ pacienteId }: { pacienteId: number }) {
  const [abierto, setAbierto] = useState(false), [revision, setRevision] = useState(0), [medicos, setMedicos] = useState<Medico[]>([])
  const [elegidos, setElegidos] = useState<number[]>([]), [principal, setPrincipal] = useState(0), [motivo, setMotivo] = useState(''), [version, setVersion] = useState('')
  const [error, setError] = useState<string | null>(null), [mensaje, setMensaje] = useState(''), [cargando, setCargando] = useState(false), [guardando, setGuardando] = useState(false)
  useEffect(() => {
    if (!abierto) return
    let vigente = true; setCargando(true); setError(null)
    fetch(`/api/pacientes/${pacienteId}/medicos`, { cache: 'no-store' }).then(async r => { const body = await r.json(); if (!r.ok) throw Error(body.error); if (!vigente) return; setMedicos(body.medicos); setElegidos(body.asignaciones.filter((a: any) => a.activo).map((a: any) => a.medico_id)); setPrincipal(body.asignaciones.find((a: any) => a.activo && a.tipo === 'principal')?.medico_id ?? 0); setVersion(body.version); setMotivo('') }).catch(e => { if (vigente) setError(e.message) }).finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [abierto, pacienteId, revision])
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (guardando || cargando || !version) return
    setGuardando(true); setError(null); setMensaje('')
    try {
      const r = await fetch(`/api/pacientes/${pacienteId}/medicos`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, motivo, medicos: elegidos.map(id => ({ id, tipo: id === principal ? 'principal' : 'colaborador' })) }) }), body = await r.json()
      if (!r.ok) throw Error(body.error)
      setVersion(body.version); setMotivo(''); setMensaje('Asignación actualizada. Los médicos retirados dejan de tener acceso al paciente.'); window.dispatchEvent(new Event('datos-actualizados'))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') } finally { setGuardando(false) }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Stethoscope size={17} className="text-blue-600" />Médicos tratantes</h4><button type="button" disabled={guardando} className={BOTON_SECUNDARIO} onClick={() => setAbierto(!abierto)}>{abierto ? 'Cerrar asignación' : 'Administrar médicos'}</button></div>{abierto && <div className="mt-4 space-y-4"><p className="text-sm leading-relaxed text-slate-500">Selecciona los médicos que pueden atender al paciente. Para transferirlo, retira al médico anterior y selecciona al nuevo. El historial se conserva.</p><AvisoClinico mensaje={error} />{mensaje && <p role="status" className="text-sm text-emerald-700">{mensaje}</p>}{cargando ? <p role="status">Cargando asignación...</p> : <form onSubmit={guardar} className="space-y-4"><fieldset disabled={guardando || !version} className="space-y-4"><div className="max-h-64 space-y-2 overflow-y-auto">{medicos.map(m => <label key={m.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" className="mt-1" checked={elegidos.includes(m.id)} onChange={e => { setElegidos(v => e.target.checked ? [...v, m.id] : v.filter(id => id !== m.id)); if (!e.target.checked && principal === m.id) setPrincipal(0) }} /><span><strong className="text-slate-800">{m.nombre}</strong><span className="mt-1 block text-xs text-slate-500">{m.especialidad}</span></span></label>)}</div><label className={ETIQUETA_CLINICA}>Médico principal<select aria-label="Médico principal" className={CAMPO_CLINICO} value={principal} onChange={e => setPrincipal(Number(e.target.value))}><option value={0}>Sin médico principal</option>{medicos.filter(m => elegidos.includes(m.id)).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label><label className={ETIQUETA_CLINICA}>Motivo de la asignación o transferencia<textarea aria-label="Motivo de la asignación o transferencia" className={CAMPO_CLINICO} minLength={3} maxLength={1000} required rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>{!elegidos.length && <p className="text-sm text-amber-700">El paciente quedará sin médicos asignados. Administración y recepción conservarán el acceso.</p>}<button type="submit" className={BOTON_PRIMARIO}>{guardando ? 'Guardando...' : 'Guardar médicos tratantes'}</button></fieldset></form>}<button type="button" disabled={guardando || cargando} className="text-xs font-semibold text-blue-600" onClick={() => setRevision(v => v + 1)}>Volver a cargar asignación</button></div>}</section>
}
