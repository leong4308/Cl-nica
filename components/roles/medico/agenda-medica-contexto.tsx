'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fechaClinica } from '@/lib/agenda/modelo'

export type CitaAgendaMedica = { consultorio?: string | null; id: number; pacienteId: number; paciente: string; inicio: string; fin: string; motivo: string; estado: string; llegada: string | null; enConsulta: string | null; notaEstado: string | null }
export type ResultadoMedico = { id: number; paciente: string; estudio: string; resultado: string | null; fecha: string; version: string; conPdf: boolean }
export type DatosAgendaMedica = { puedeValidarLaboratorio?: boolean; dia: string; ahora: string; citas: CitaAgendaMedica[]; abiertas: { id: number; paciente: string; inicio: string }[]; resultados: ResultadoMedico[]; incidencias: { id: number; paciente: string; texto: string; fecha: string }[] }
export const citaActivaMedica = (c: CitaAgendaMedica) => ['pendiente', 'confirmada'].includes(c.estado)
type Agenda = { dia: string; setDia: (dia: string) => void; datos: DatosAgendaMedica | null; error: string; setError: (error: string) => void; cargar: () => Promise<void> }
const Contexto = createContext<Agenda | null>(null)
export function usarAgendaMedica() {
  const agenda = useContext(Contexto)
  if (!agenda) throw Error('La agenda médica requiere su proveedor.')
  return agenda
}
export function ProveedorAgendaMedica({ activo, children }: { activo: boolean; children: ReactNode }) {
  const [dia, setDia] = useState(fechaClinica), [datos, setDatos] = useState<DatosAgendaMedica | null>(null), [error, setError] = useState('')
  const refrescar = useRef<() => Promise<void>>(async () => {})
  const cargar = useCallback(() => refrescar.current(), [])
  useEffect(() => {
    setDatos(null); setError('')
    if (!activo) return
    let vigente = true, pendiente = false, trabajo: Promise<void> | null = null
    const controller = new AbortController()
    const actualizar = (): Promise<void> => {
      if (!vigente) return Promise.resolve()
      if (trabajo) { pendiente = true; return trabajo }
      trabajo = (async () => {
        do {
          pendiente = false
          try {
            const r = await fetch(`/api/medico?dia=${dia}`, { cache: 'no-store', signal: controller.signal }), b = await r.json()
            if (!r.ok) throw Error(b.error || 'No se pudo actualizar tu agenda.')
            if (b.dia !== dia || !Array.isArray(b.citas) || !Array.isArray(b.abiertas) || !Array.isArray(b.resultados)) throw Error('No se pudo comprobar la agenda recibida.')
            if (vigente) { setDatos(b); setError('') }
          } catch (e) { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo actualizar tu agenda.') }
        } while (vigente && pendiente)
      })().finally(() => { trabajo = null })
      return trabajo
    }
    refrescar.current = actualizar
    const alCambiar = () => { if (!document.hidden) void actualizar() }
    void actualizar()
    const timer = window.setInterval(alCambiar, 5000)
    window.addEventListener('datos-actualizados', alCambiar); window.addEventListener('focus', alCambiar); window.addEventListener('online', alCambiar)
    document.addEventListener('visibilitychange', alCambiar)
    return () => {
      vigente = false; controller.abort(); refrescar.current = async () => {}
      clearInterval(timer)
      window.removeEventListener('datos-actualizados', alCambiar); window.removeEventListener('focus', alCambiar); window.removeEventListener('online', alCambiar)
      document.removeEventListener('visibilitychange', alCambiar)
    }
  }, [activo, dia])
  return <Contexto.Provider value={{dia,setDia,datos,error,setError,cargar}}>{children}</Contexto.Provider>
}
