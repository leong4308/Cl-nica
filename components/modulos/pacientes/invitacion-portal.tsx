'use client'
import { useCallback, useEffect, useState } from 'react'
import { Mail, ShieldCheck } from 'lucide-react'
import { BOTON_PRIMARIO } from '../compartidos/editor-clinico'
type Estado = { correo: string | null; activa: boolean; invitada: boolean; enviada: string | null; vence: string | null; errorEnvio: boolean; configurado: boolean }
export function InvitacionPortal({ pacienteId }: { pacienteId: number }) {
  const [datos, setDatos] = useState<Estado | null>(null), [error, setError] = useState(''), [aviso, setAviso] = useState(''), [confirmado, setConfirmado] = useState(false), [guardando, setGuardando] = useState(false)
  const cargar = useCallback(async (signal?: AbortSignal) => {
    try { const r = await fetch(`/api/pacientes/${pacienteId}/portal`, { cache: 'no-store', signal }), b = await r.json(); if (!r.ok) throw Error(b.error); if (!signal?.aborted) setDatos(b) } catch (e) { if (!signal?.aborted) setError((e as Error).message) }
  }, [pacienteId])
  useEffect(() => { const c = new AbortController(); void cargar(c.signal); return () => c.abort() }, [cargar])
  async function enviar() {
    if (guardando || !confirmado) return
    setGuardando(true); setError(''); setAviso('')
    try { const r = await fetch(`/api/pacientes/${pacienteId}/portal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmarCorreo: true }) }), b = await r.json(); if (!r.ok) throw Error(b.error); setAviso(b.mensaje); setConfirmado(false); await cargar() } catch (e) { setError((e as Error).message) } finally { setGuardando(false) }
  }
  return <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5" aria-label="Acceso al portal del paciente"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Mail size={18} className="text-blue-600" />Acceso al portal del paciente</h3>{datos?.activa ? <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700"><ShieldCheck size={17} />Cuenta vinculada. El paciente puede iniciar sesión o recuperar su contraseña.</p> : datos && <div className="mt-3 space-y-3"><p className="text-sm text-slate-600">El paciente recibirá un enlace para elegir su contraseña y acceder a su ficha existente.</p><p className="break-all text-sm font-semibold">{datos.correo || 'Sin correo registrado'}</p>{!datos.correo && <p className="text-xs text-amber-800">Edita la información y registra primero el correo del paciente.</p>}{!datos.configurado && <p className="text-xs text-amber-800">Administración debe configurar el servicio de correo antes de enviar invitaciones.</p>}{datos.invitada && <p className="text-xs text-slate-500">Hay una invitación pendiente{datos.enviada ? ' enviada al servicio de correo' : ''}. Un nuevo envío invalida el enlace anterior.</p>}{datos.correo && datos.configurado && <><label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"><input className="mt-0.5" type="checkbox" disabled={guardando} checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />Verifiqué con el paciente que este es su correo.</label><button disabled={guardando || !confirmado} onClick={() => void enviar()} className={BOTON_PRIMARIO}><Mail size={16} />{guardando ? 'Enviando…' : datos.invitada ? 'Reenviar invitación' : 'Invitar al portal'}</button></>}</div>}{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{aviso && <p role="status" className="mt-3 text-sm text-emerald-700">{aviso}</p>}</section>
}
