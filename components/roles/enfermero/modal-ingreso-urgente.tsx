'use client'
import { useEffect, useRef, useState } from 'react'
import { ModalMarco } from '@/components/modulos/compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO } from '@/components/modulos/compartidos/editor-clinico'
import { FormularioIngreso, INGRESO_VACIO, type BorradorIngreso } from '@/components/modulos/internacion/formulario-ingreso'
import type { DatosHospital } from '@/lib/internacion/modelo'

export function ModalIngresoUrgente({ onClose, onGuardado, camaIdInicial }: { camaIdInicial?: number; onClose: () => void; onGuardado: (mensaje: string) => void }) {
  const [datos, setDatos] = useState<DatosHospital | null>(null), [borrador, setBorrador] = useState<BorradorIngreso>({ ...INGRESO_VACIO, camaId: camaIdInicial ?? '' })
  const [confirmado, setConfirmado] = useState(false), [guardando, setGuardando] = useState(false), [consultando, setConsultando] = useState(false), [revision, setRevision] = useState(0), [error, setError] = useState<string | null>(null)
  const clave = useRef(crypto.randomUUID()), ocupado = useRef(false)
  useEffect(() => {
    const c = new AbortController()
    const t = setTimeout(async () => {
      setConsultando(true)
      try {
        const r = await fetch('/api/enfermeria/ingresos', { cache: 'no-store', signal: c.signal }), b = await r.json()
        if (!r.ok) throw Error(b.error || 'No se pudieron consultar las opciones de ingreso.')
        if (!c.signal.aborted) setDatos(b)
      } catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo consultar la disponibilidad.') }
      finally { if (!c.signal.aborted) setConsultando(false) }
    }, 0)
    return () => { clearTimeout(t); c.abort() }
  }, [revision])
  function cambiar(b: BorradorIngreso) { setBorrador(b); setConfirmado(false); clave.current = crypto.randomUUID() }
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (ocupado.current || !confirmado || !borrador.pacienteId || !borrador.medicoId || !borrador.camaId || !borrador.motivo.trim()) return
    ocupado.current = true; setGuardando(true); setError(null)
    try {
      const r = await fetch('/api/enfermeria/ingresos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: clave.current, datos: { pacienteId: borrador.pacienteId, medicoId: borrador.medicoId, camaId: borrador.camaId, motivo: borrador.motivo, observaciones: borrador.diagnostico, confirmado } }) }), b = await r.json()
      if (!r.ok) { if (r.status === 409) { setConfirmado(false); setRevision(v => v + 1) }; throw Error(b.error || 'No se pudo registrar el ingreso.') }
      window.dispatchEvent(new Event('datos-actualizados'))
      onGuardado(`Ingreso urgente #${b.id} registrado. La cama quedó ocupada y se avisó al médico y a recepción. Administración puede asignar el turno de cuidados.`); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Tus datos se conservan para reintentar.') }
    finally { ocupado.current = false; setGuardando(false) }
  }
  return <ModalMarco title="Registrar ingreso urgente" ancho="max-w-6xl" contenidoFijo onClose={() => { if (!ocupado.current) onClose() }} footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs text-slate-500">El ingreso ocupa la cama. La disponibilidad se vuelve a verificar al confirmar.</p><div className="flex gap-3"><button type="button" disabled={guardando} className={BOTON_SECUNDARIO} onClick={onClose}>Cancelar</button><button type="submit" form="ingreso-urgente" disabled={guardando || consultando || !datos || !confirmado || !borrador.pacienteId || !borrador.medicoId || !borrador.camaId || !borrador.motivo.trim()} className={BOTON_PRIMARIO}>{guardando ? 'Registrando...' : 'Registrar ingreso'}</button></div></div>}>
    <p className="mb-4 text-sm text-slate-600">Registra al paciente en una cama disponible de tu clínica e indica al médico que estará a cargo. Los avisos al equipo se generan al guardar.</p>
    <AvisoClinico mensaje={error} />
    {datos && !datos.pacientes.length && !consultando && <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No hay pacientes activos disponibles para ingresar. Recepción puede registrar pacientes nuevos; los que ya están hospitalizados no se ofrecen de nuevo.</p>}
    {datos && <form id="ingreso-urgente" onSubmit={guardar}><FormularioIngreso datos={datos} borrador={borrador} onChange={cambiar} disabled={guardando} soloObservaciones /><label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><input type="checkbox" checked={confirmado} disabled={guardando} onChange={e => setConfirmado(e.target.checked)} className="mt-0.5" />Confirmo el paciente, el médico y la cama seleccionados para registrar el ingreso urgente.</label><p className="mt-3 text-xs text-slate-500">Las observaciones de enfermería no sustituyen el diagnóstico médico. Los turnos de cuidados siguen siendo asignados por administración.</p></form>}
    {!datos && error && <button type="button" className={BOTON_SECUNDARIO} onClick={() => { setError(null); setRevision(v => v + 1) }}>Reintentar consulta</button>}
  </ModalMarco>
}
