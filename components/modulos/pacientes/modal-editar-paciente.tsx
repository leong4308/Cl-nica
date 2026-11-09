'use client'

import { useEffect, useState } from 'react'
import { Loader2, Phone, UserRound } from 'lucide-react'
import { ModalMarco } from '../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, ETIQUETA_CLINICA, PanelClinico } from '../compartidos/editor-clinico'
import { cargarPerfilPaciente } from '@/lib/supabase/datos'
import { registrarPerfilPacienteEnCache } from '@/lib/supabase/cache-pacientes'

type Datos = { nombre: string; correo: string; telefono: string; fechaNacimiento: string; genero: string; contactoEmergencia: string; telefonoEmergencia: string }
export function ModalEditarPaciente({ pacienteId, onClose, onSave }: { pacienteId: number; onClose: () => void; onSave?: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/pacientes/${pacienteId}`, { signal: controller.signal }).then(async (res) => { const json = await res.json(); if (!res.ok) throw Error(json.error); setDatos(json.paciente) }).catch((err) => { if (!controller.signal.aborted) setError(err.message || 'No se pudo cargar el paciente.') })
    return () => controller.abort()
  }, [pacienteId])
  function actualizar(campo: keyof Datos, valor: string) { setDatos((prev) => prev ? { ...prev, [campo]: valor } : prev) }
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (!datos || guardando) return
    setGuardando(true); setError(null); setMensaje('')
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      const json = await res.json()
      if (!res.ok) throw Error(json.error || 'No se pudo actualizar el paciente.')
      try {
        const actualizado = await cargarPerfilPaciente(pacienteId)
        if (actualizado.perfil) registrarPerfilPacienteEnCache(actualizado.perfil)
      } catch { /* La actualización ya se guardó; la lista volverá a consultar los datos. */ }
      window.dispatchEvent(new Event('datos-actualizados'))
      setMensaje('Información del paciente actualizada.')
      onSave?.()
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.') }
    finally { setGuardando(false) }
  }
  return <ModalMarco title="Editar información del paciente" ancho="max-w-4xl" contenidoFijo onClose={() => { if (!guardando) onClose() }} footer={<div className="flex flex-wrap justify-between gap-3"><button type="button" className={BOTON_SECUNDARIO} onClick={onClose} disabled={guardando}>Cerrar</button><button type="submit" form="form-editar-paciente" className={BOTON_PRIMARIO} disabled={!datos || guardando || !datos.nombre.trim()}>{guardando && <Loader2 size={16} className="animate-spin" />}{guardando ? 'Guardando...' : 'Guardar cambios'}</button></div>}>
    <p className="mb-5 text-sm text-slate-500">Actualiza los datos personales y de contacto del paciente seleccionado.</p>
    <AvisoClinico mensaje={error} />{mensaje && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{mensaje}</p>}
    {!datos ? !error && <p role="status" className="py-12 text-center text-sm text-slate-500">Cargando paciente...</p> : <form id="form-editar-paciente" onSubmit={guardar}><fieldset disabled={guardando} className="grid min-w-0 gap-5 md:grid-cols-2">
      <PanelClinico icon={UserRound} titulo="Datos personales" ayuda={`Paciente #${pacienteId}`}><div className="space-y-4">
        <label className={ETIQUETA_CLINICA}>Nombre completo<input className={CAMPO_CLINICO} value={datos.nombre} onChange={(e) => actualizar('nombre', e.target.value)} required maxLength={200} autoComplete="name" /></label>
        <label className={ETIQUETA_CLINICA}>Teléfono<input type="tel" className={CAMPO_CLINICO} value={datos.telefono} onChange={(e) => actualizar('telefono', e.target.value)} maxLength={20} /></label>
        <label className={ETIQUETA_CLINICA}>Fecha de nacimiento<input type="date" className={CAMPO_CLINICO} value={datos.fechaNacimiento} onChange={(e) => actualizar('fechaNacimiento', e.target.value)} max={new Date().toISOString().slice(0, 10)} /></label>
        <label className={ETIQUETA_CLINICA}>Género<select className={CAMPO_CLINICO} value={datos.genero} onChange={(e) => actualizar('genero', e.target.value)}><option value="">Sin registrar</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="O">Otro</option></select></label>
      </div></PanelClinico>
      <PanelClinico icon={Phone} titulo="Contacto y acceso" ayuda="Información para comunicarse con el paciente." suave><div className="space-y-4">
        <label className={ETIQUETA_CLINICA}>Correo de acceso<input type="email" className={CAMPO_CLINICO + ' bg-slate-50'} value={datos.correo} readOnly /></label>
        <label className={ETIQUETA_CLINICA}>Contacto de emergencia<input className={CAMPO_CLINICO} value={datos.contactoEmergencia} onChange={(e) => actualizar('contactoEmergencia', e.target.value)} maxLength={200} /></label>
        <label className={ETIQUETA_CLINICA}>Teléfono de emergencia<input type="tel" className={CAMPO_CLINICO} value={datos.telefonoEmergencia} onChange={(e) => actualizar('telefonoEmergencia', e.target.value)} maxLength={20} /></label>
      </div></PanelClinico>
    </fieldset></form>}
  </ModalMarco>
}
