'use client'

import { useEffect, useState } from 'react'
import {
  cargarClinicaActiva,
  cargarDisponibilidad,
  cargarMedicosAgenda,
  cargarPacientesParaCita,
  crearCita,
  type DiaDisponible,
  type MedicoAgenda,
} from '@/lib/supabase/datos'
import { actualizarAgendaEnCache, leerCacheCita } from '@/lib/supabase/cache-cita'
import { ModalMarco } from '../../../compartidos/modal-marco'
import { BotonCancelarCita } from './cancelar-cita/boton-cancelar-cita'
import { BotonGuardarCita } from './guardar-cita/boton-guardar-cita'
import { BuscadorPacienteCita } from './buscador-paciente-cita'
import { SelectorCita } from './selector-cita'

type PropsModalNuevaCita = {
  onClose: () => void
  onSave: (value: string) => void
}

export function ModalNuevaCita({ onClose, onSave }: PropsModalNuevaCita) {
  const cacheInicial = leerCacheCita()
  const medicoInicial = cacheInicial?.medicos[0]?.id ?? null
  const agendaInicial =
    medicoInicial !== null ? cacheInicial?.agendas[medicoInicial] : undefined

  const [medicos, setMedicos] = useState<MedicoAgenda[]>(cacheInicial?.medicos ?? [])
  const [pacientesCita, setPacientesCita] = useState<{ id: number; nombre: string }[]>(cacheInicial?.pacientes ?? [])
  const [clinicaId, setClinicaId] = useState<number | null>(cacheInicial?.clinicaId ?? null)
  const [medicoId, setMedicoId] = useState<number | null>(medicoInicial)
  const [pacienteId, setPacienteId] = useState<number | null>(null)
  const [disponibilidad, setDisponibilidad] = useState<DiaDisponible[]>(agendaInicial?.filas ?? [])
  const [fechaSeleccionada, setFechaSeleccionada] = useState(agendaInicial?.filas[0]?.fecha ?? '')
  const [horarioSeleccionado, setHorarioSeleccionado] = useState('')
  const [citaError, setCitaError] = useState('')
  const [cargandoCita, setCargandoCita] = useState(!cacheInicial)
  const [cargandoAgenda, setCargandoAgenda] = useState(false)
  const [citaLista, setCitaLista] = useState(cacheInicial !== null)
  const [guardandoCita, setGuardandoCita] = useState(false)

  useEffect(() => {
    if (cacheInicial) return
    let vigente = true
    setCargandoCita(true)
    Promise.all([cargarMedicosAgenda(), cargarPacientesParaCita(), cargarClinicaActiva()])
      .then(([medicosResult, pacientesResult, clinica]) => {
        if (!vigente) return
        setMedicos(medicosResult.filas)
        setPacientesCita(pacientesResult.filas)
        setClinicaId(clinica)
        setMedicoId((anterior) => anterior ?? medicosResult.filas[0]?.id ?? null)
        setCitaError(medicosResult.error ?? '')
        setCargandoCita(false)
        if (medicosResult.filas.length === 0) setCitaLista(true)
      })
    return () => { vigente = false }
  }, [cacheInicial])

  const cambiarMedico = (nuevoId: number) => {
    setMedicoId(nuevoId)
    setHorarioSeleccionado('')

    const guardada = leerCacheCita()?.agendas[nuevoId]
    if (guardada) {
      setDisponibilidad(guardada.filas)
      setFechaSeleccionada(guardada.filas[0]?.fecha ?? '')
      setCitaError(guardada.error ?? '')
      setCargandoAgenda(false)
      setCitaLista(true)
      return
    }

    const medico = medicos.find((m) => m.id === nuevoId)
    setCargandoAgenda(true)
    cargarDisponibilidad(nuevoId, medico?.duracionConsulta ?? 20).then((resultado) => {
      setDisponibilidad(resultado.filas)
      setFechaSeleccionada(resultado.filas[0]?.fecha ?? '')
      setCitaError(resultado.error ?? '')
      setCargandoAgenda(false)
      setCitaLista(true)
    })
  }

  useEffect(() => {
    if (medicoId === null) return
    if (leerCacheCita()?.agendas[medicoId]) return
    let vigente = true
    setCargandoAgenda(true)
    const medico = medicos.find((m) => m.id === medicoId)
    cargarDisponibilidad(medicoId, medico?.duracionConsulta ?? 20).then((resultado) => {
      if (!vigente) return
      setDisponibilidad(resultado.filas)
      setFechaSeleccionada(resultado.filas[0]?.fecha ?? '')
      setCitaError(resultado.error ?? '')
      setCargandoAgenda(false)
      setCitaLista(true)
    })
    return () => { vigente = false }
  }, [medicoId, medicos])

  const medicoSeleccionado = medicos.find((m) => m.id === medicoId) ?? null
  const puedeGuardarCita =
    !cargandoCita && !cargandoAgenda && !guardandoCita &&
    pacienteId !== null && medicoId !== null && clinicaId !== null &&
    fechaSeleccionada !== '' && horarioSeleccionado !== ''

  async function confirmarCita() {
    if (!puedeGuardarCita || medicoId === null || clinicaId === null || pacienteId === null || !medicoSeleccionado) return
    setGuardandoCita(true)
    setCitaError('')
    const resultado = await crearCita({
      pacienteId,
      medicoId,
      clinicaId,
      fecha: fechaSeleccionada,
      hora: horarioSeleccionado,
      motivo: 'Consulta general',
      duracionConsulta: medicoSeleccionado.duracionConsulta,
    })
    setGuardandoCita(false)
    if (resultado.error) {
      setCitaError(resultado.error)
      return
    }

    window.dispatchEvent(new CustomEvent('datos-actualizados'))

    onSave(`Cita #${resultado.id} · ${medicoSeleccionado.nombre} · ${fechaSeleccionada} · ${horarioSeleccionado}`)

    void cargarDisponibilidad(medicoId, medicoSeleccionado.duracionConsulta).then((frescos) => {
      actualizarAgendaEnCache(medicoId, frescos.filas, frescos.error)
    })
  }

  if (!citaLista) return null

  return (
    <ModalMarco
      title="Nueva cita"
      onClose={onClose}
      footer={
        <div className="mt-6 flex justify-end gap-2">
          <BotonCancelarCita deshabilitado={guardandoCita} onCancelar={onClose} />
          <BotonGuardarCita deshabilitado={!puedeGuardarCita} guardando={guardandoCita} onGuardar={confirmarCita} />
        </div>
      }
      aviso={
        !guardandoCita && !puedeGuardarCita ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            {pacienteId === null
              ? 'Falta elegir al paciente.'
              : medicoId === null
                ? 'Falta elegir al médico.'
                : 'Falta elegir la fecha y la hora.'}
          </p>
        ) : null
      }
    >
      {!cargandoCita && (
        <BuscadorPacienteCita
          pacientes={pacientesCita}
          seleccionadoId={pacienteId}
          onSeleccionar={(id) => setPacienteId(id === 0 ? null : id)}
        />
      )}

      {!cargandoCita && (
        <SelectorCita
          cargando={cargandoCita}
          cargandoAgenda={cargandoAgenda}
          medicos={medicos}
          medicoId={medicoId}
          onMedico={cambiarMedico}
          dias={disponibilidad}
          diaActual={disponibilidad.find((d) => d.fecha === fechaSeleccionada) ?? null}
          fecha={fechaSeleccionada}
          onFecha={(f) => {
            setFechaSeleccionada(f)
            setHorarioSeleccionado('')
          }}
          horario={horarioSeleccionado}
          onHorario={setHorarioSeleccionado}
          error={citaError}
        />
      )}
    </ModalMarco>
  )
}
