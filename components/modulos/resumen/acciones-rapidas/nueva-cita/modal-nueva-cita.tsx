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
import { BuscadorPacienteCita } from './buscador-paciente-cita'
import { SelectorCita } from './selector-cita'

type PropsModalNuevaCita = {
  onClose: () => void
  /** Entrega el resumen de la cita creada para que `app/page.tsx` lo notifique. */
  onSave: (value: string) => void
}

/**
 * Modal de "Nueva cita": paciente + médico + día + hora.
 *
 * Todo lo que alimenta a este modal vive en esta misma carpeta
 * (`acciones-rapidas/nueva-cita/`), salvo `ModalMarco`, que es la carcasa que
 * comparten todos los modales de la app.
 *
 * Los horarios que se pintan salen de `lib/supabase/datos.ts` a partir de la
 * agenda del médico en `agenda_medicos` (2 ventanas de tarde, 14 huecos de
 * 25 min por día).
 */
export function ModalNuevaCita({ onClose, onSave }: PropsModalNuevaCita) {
  // La caché se lee de forma síncrona durante el render: si los datos ya
  // estaban precargados al entrar a la app, el modal aparece completo de una.
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
  // Con la caché llena el modal se dibuja desde el primer render; sin ella
  // espera a que termine la carga, para no aparecer a medias.
  const [citaLista, setCitaLista] = useState(cacheInicial !== null)
  // Guardar es un estado aparte de "cargar": si se reutilizara `cargandoCita`, el
  // modal se quedaría sin campos mientras corre la escritura y saltaría el aviso
  // de "Falta elegir la fecha y la hora" aunque ya estuviera todo elegido.
  const [guardandoCita, setGuardandoCita] = useState(false)

  // Carga inicial: médicos, pacientes y clínica. Solo si no vinieron en caché.
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
        // Sin médicos no hay agenda que cargar: liberamos el modal para que sí
        // aparezca y muestre el aviso de que no hay médicos registrados.
        if (medicosResult.filas.length === 0) setCitaLista(true)
      })
    return () => { vigente = false }
  }, [cacheInicial])

  /** Cambia de médico usando la caché si la tiene; si no, la pide a Supabase. */
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

  // Agenda inicial cuando no había caché (el resto ya lo resuelve `cambiarMedico`).
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

    // Avisa al resto de la app para que vuelva a leer el módulo desde Supabase.
    window.dispatchEvent(new CustomEvent('datos-actualizados'))

    // Cierra de inmediato: si se esperara aquí a releer la disponibilidad, el
    // modal se quedaría abierto medio segundo sin motivo.
    onSave(`Cita #${resultado.id} · ${medicoSeleccionado.nombre} · ${fechaSeleccionada} · ${horarioSeleccionado}`)

    // El horario recién usado se libera en segundo plano, solo para la caché:
    // así el modal ya está cerrado y no se llama a setState sobre un componente
    // desmontado.
    void cargarDisponibilidad(medicoId, medicoSeleccionado.duracionConsulta).then((frescos) => {
      actualizarAgendaEnCache(medicoId, frescos.filas, frescos.error)
    })
  }

  // "Nueva cita" no se dibuja hasta tener médicos, pacientes y agenda: así
  // aparece de una sola vez ya completo, sin parpadear estados intermedios.
  // Va DESPUÉS de todos los hooks para no romper las Rules of Hooks.
  if (!citaLista) return null

  return (
    <ModalMarco
      title="Nueva cita"
      onClose={onClose}
      footer={
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={guardandoCita}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarCita}
            disabled={!puedeGuardarCita}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardandoCita ? 'Guardando…' : 'Guardar'}
          </button>
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
