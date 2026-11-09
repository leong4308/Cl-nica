'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ModalMarco } from '../../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO } from '../../compartidos/editor-clinico'
import { consultarHospital, guardarHospital, type DatosHospital } from '@/lib/internacion/modelo'
import { FormularioIngreso, INGRESO_VACIO, type BorradorIngreso } from '../formulario-ingreso'

export function ModalNuevaAdmision({ camaIdInicial, onClose, onSave }: { camaIdInicial?: number; onClose: () => void; onSave?: (mensaje: string) => void }) {
  const [datos, setDatos] = useState<DatosHospital | null>(null)
  const [borrador, setBorrador] = useState<BorradorIngreso>({ ...INGRESO_VACIO, camaId: camaIdInicial ?? '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => { const controller = new AbortController(); consultarHospital<DatosHospital>('', { signal: controller.signal }).then(setDatos).catch((err) => { if (!controller.signal.aborted) setError(err.message) }); return () => controller.abort() }, [revision])
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (guardando || !borrador.pacienteId || !borrador.medicoId || !borrador.camaId || !borrador.motivo.trim()) return
    setGuardando(true); setError(null)
    try {
      await guardarHospital('', borrador)
      const nombre = datos?.pacientes.find((p) => p.id === borrador.pacienteId)?.nombre ?? 'Paciente'
      window.dispatchEvent(new Event('datos-actualizados'))
      onSave?.(`Ingreso de ${nombre} registrado correctamente`); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo registrar el ingreso.'); setRevision((v) => v + 1) }
    finally { setGuardando(false) }
  }
  return <ModalMarco title="Nueva admisión hospitalaria" ancho="max-w-6xl" contenidoFijo onClose={() => { if (!guardando) onClose() }} footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">La disponibilidad se verifica de nuevo al guardar.</p><div className="flex gap-3"><button type="button" className={BOTON_SECUNDARIO} disabled={guardando} onClick={onClose}>Cancelar</button><button type="submit" form="form-nueva-admision" className={BOTON_PRIMARIO} disabled={guardando || !datos || !borrador.pacienteId || !borrador.medicoId || !borrador.camaId || !borrador.motivo.trim()}>{guardando && <Loader2 size={16} className="animate-spin" />}{guardando ? 'Registrando...' : 'Registrar ingreso'}</button></div></div>}>
    <p className="mb-5 text-sm text-slate-500">Vincula al paciente con su médico y una cama disponible, y registra la información de ingreso.</p><AvisoClinico mensaje={error} />
    {!datos ? !error && <p role="status" className="py-12 text-center text-sm text-slate-500">Cargando pacientes, médicos y disponibilidad...</p> : <form id="form-nueva-admision" onSubmit={guardar}><FormularioIngreso datos={datos} borrador={borrador} onChange={setBorrador} disabled={guardando} /></form>}
    {!datos && error && <button type="button" className={BOTON_SECUNDARIO} onClick={() => { setError(null); setRevision((v) => v + 1) }}>Volver a cargar</button>}
  </ModalMarco>
}
