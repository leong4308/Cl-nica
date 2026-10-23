'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ClinicActions } from '../compartidos/types'
import type { PerfilSesion } from '@/lib/supabase/sesion'
import type { MedicoPerfil, CitaAgendaMedico, SignosVitales, MedicamentoPrescrito, DiagnosticoCie10 } from './types'
import { obtenerMedicosBD, obtenerCitasAgendaMedico, finalizarConsultaYFirmar } from './datos-medicos'
import { MedicoHeader } from './medico-header'
import { AgendaDia } from './agenda-dia'
import { PacienteHeader } from './paciente-header'
import { SignosVitalesWidget } from './signos-vitales'
import { AntecedentesMedicamentos } from './antecedentes-medicamentos'
import { ExpedienteDigital } from './expediente-digital'
import { ConsultaSoap } from './consulta-soap'
import { PrescripcionReceta } from './prescripcion-receta'
import { ConsultaFooter } from './consulta-footer'
import { DirectorioMedicos } from './directorio-medicos'
import { CalendarPlus, CalendarX2 } from 'lucide-react'

export function MedicosWorkstation({ notify, openModal, usuario }: ClinicActions & { usuario?: PerfilSesion }) {
  const [medicos, setMedicos] = useState<MedicoPerfil[]>([])
  const [medicoSeleccionado, setMedicoSeleccionado] = useState<MedicoPerfil | null>(null)
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(new Date())
  const [citas, setCitas] = useState<CitaAgendaMedico[]>([])
  const [citaActiva, setCitaActiva] = useState<CitaAgendaMedico | null>(null)
  const [vistaModo, setVistaModo] = useState<'estacion' | 'directorio'>('estacion')
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  // Estados locales editables para la consulta activa
  const [signosVitales, setSignosVitales] = useState<SignosVitales | undefined>(undefined)
  const [soap, setSoap] = useState<{
    subjetivo: string
    objetivo: string
    diagnosticos: DiagnosticoCie10[]
    plan: string
  }>({
    subjetivo: '',
    objetivo: '',
    diagnosticos: [],
    plan: '',
  })
  const [prescripciones, setPrescripciones] = useState<MedicamentoPrescrito[]>([])

  const esMedico = usuario?.rol === 'medico'
  const esAdmin = usuario?.rol === 'admin'
  const esRecepcionista = usuario?.rol === 'recepcionista'

  // Determinar si el usuario puede gestionar (admin/recepcionista) o solo consultar (médico)
  const puedeGestionar = esAdmin || esRecepcionista
  const puedeVerDirectorio = esAdmin || esRecepcionista
  const puedeCambiarMedico = esAdmin || esRecepcionista
  const puedeRegistrarMedico = esAdmin

  // 1. Cargar médicos reales desde Supabase
  useEffect(() => {
    let activo = true
    obtenerMedicosBD().then((res) => {
      if (!activo) return
      setMedicos(res)

      if (res.length > 0) {
        // Si el usuario logueado es médico, fijarlo a su perfil — NO puede cambiar
        if (esMedico && usuario?.medicoId) {
          const propio = res.find((m) => m.id === usuario.medicoId) || res[0]
          setMedicoSeleccionado(propio)
        } else {
          setMedicoSeleccionado(res[0])
        }
      }
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [esMedico, usuario?.medicoId])

  // 2. Cargar agenda de citas para el médico y fecha seleccionados
  const refrescarAgenda = useCallback(async (mId?: number, f?: Date) => {
    const medId = mId ?? medicoSeleccionado?.id
    if (!medId) return

    const fechaTarget = f ?? fechaSeleccionada
    const isoFecha = fechaTarget.toISOString().split('T')[0]
    const resultado = await obtenerCitasAgendaMedico(medId, isoFecha)
    setCitas(resultado)

    // Si hay citas, seleccionar la primera o en espera; si no hay, limpiar
    if (resultado.length > 0) {
      const enEspera = resultado.find((c) => c.estado === 'en_espera' || c.estado === 'confirmada') || resultado[0]
      seleccionarPaciente(enEspera)
    } else {
      setCitaActiva(null)
    }
  }, [medicoSeleccionado?.id, fechaSeleccionada])

  useEffect(() => {
    if (medicoSeleccionado?.id) {
      refrescarAgenda(medicoSeleccionado.id, fechaSeleccionada)
    }
  }, [medicoSeleccionado?.id, fechaSeleccionada, refrescarAgenda])

  // 3. Escuchar evento global 'datos-actualizados' (cuando recepcionista asigna paciente o se crea cita)
  useEffect(() => {
    const alActualizar = () => {
      if (medicoSeleccionado?.id) {
        refrescarAgenda(medicoSeleccionado.id, fechaSeleccionada)
      }
    }
    window.addEventListener('datos-actualizados', alActualizar)
    return () => window.removeEventListener('datos-actualizados', alActualizar)
  }, [medicoSeleccionado?.id, fechaSeleccionada, refrescarAgenda])

  const seleccionarPaciente = (cita: CitaAgendaMedico) => {
    setCitaActiva(cita)
    setSignosVitales(cita.signosVitales)
    setSoap({
      subjetivo: cita.soap?.subjetivo || 'Paciente acude a consulta programada.',
      objetivo: cita.soap?.objetivo || 'Paciente orientado, signos vitales dentro de parámetros normales.',
      diagnosticos: cita.soap?.diagnosticos || [
        { codigo: 'Z00.0', descripcion: 'Examen médico general', tipo: 'Principal' },
      ],
      plan: cita.soap?.plan || 'Plan de tratamiento y recomendaciones.',
    })
    setPrescripciones(cita.prescripciones || [])
  }

  const handleCambiarFecha = (delta: number) => {
    const nueva = new Date(fechaSeleccionada)
    nueva.setDate(nueva.getDate() + delta)
    setFechaSeleccionada(nueva)
  }

  const handleHoy = () => {
    setFechaSeleccionada(new Date())
  }

  const handleIniciarConsulta = (cita: CitaAgendaMedico) => {
    seleccionarPaciente(cita)
    notify(`Consulta iniciada para ${cita.pacienteNombre}`)
  }

  const handleAbrirExpediente = (cita: CitaAgendaMedico) => {
    seleccionarPaciente(cita)
    notify(`Expediente de ${cita.pacienteNombre} cargado`)
  }

  const handleGuardarBorrador = () => {
    if (!citaActiva) return
    notify(`Borrador de consulta para ${citaActiva.pacienteNombre} guardado automáticamente`)
  }

  const handleConcluirYFirmar = async () => {
    if (!citaActiva) return
    setGuardando(true)
    try {
      const resp = await finalizarConsultaYFirmar({
        citaId: citaActiva.id,
        soap,
        diagnosticos: soap.diagnosticos,
        prescripciones,
        signosVitales,
      })

      if (resp.ok) {
        setCitas((prev) =>
          prev.map((c) => (c.id === citaActiva.id ? { ...c, estado: 'atendida' as const } : c))
        )
        setCitaActiva((prev) => (prev ? { ...prev, estado: 'atendida' as const } : null))
        notify(resp.mensaje)
      } else {
        notify(`Aviso: ${resp.mensaje}`)
      }
    } finally {
      setGuardando(false)
    }
  }

  if (cargando || !medicoSeleccionado) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
        <div className="text-center text-xs text-slate-500 font-medium">
          Cargando estación médica de la base de datos...
        </div>
      </div>
    )
  }

  // Cálculos de KPIs del día
  const totalCitas = citas.length
  const confirmadas = citas.filter((c) => c.estado === 'confirmada' || c.estado === 'en_espera').length
  const pendientes = citas.filter((c) => c.estado === 'pendiente').length
  const atendidas = citas.filter((c) => c.estado === 'atendida').length

  return (
    <section className="space-y-6">
      {/* Cabecera Principal del Médico y Navegación */}
      <MedicoHeader
        medicos={medicos}
        medicoSeleccionado={medicoSeleccionado}
        onCambiarMedico={(m) => {
          setMedicoSeleccionado(m)
          setVistaModo('estacion')
        }}
        fechaSeleccionada={fechaSeleccionada}
        onCambiarFecha={handleCambiarFecha}
        onHoy={handleHoy}
        totalCitas={totalCitas}
        confirmadas={confirmadas}
        pendientes={pendientes}
        atendidas={atendidas}
        vistaModo={vistaModo}
        onCambiarVista={setVistaModo}
        esMedico={esMedico}
        puedeCambiarMedico={puedeCambiarMedico}
        puedeVerDirectorio={puedeVerDirectorio}
      />

      {/* Vista de Directorio Staff — solo visible para admin/recepcionista */}
      {vistaModo === 'directorio' && puedeVerDirectorio ? (
        <DirectorioMedicos
          medicos={medicos}
          onSeleccionarMedico={(m) => {
            setMedicoSeleccionado(m)
            setVistaModo('estacion')
          }}
          onAbrirModal={openModal}
          puedeRegistrar={puedeRegistrarMedico}
        />
      ) : (
        /* Vista de Estación Médica: 2 Columnas */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* Columna Izquierda: Agenda del Día (4 columnas) */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-4">
            {citas.length > 0 ? (
              <AgendaDia
                citas={citas}
                citaSeleccionadaId={citaActiva?.id ?? 0}
                onSeleccionarCita={seleccionarPaciente}
                onIniciarConsulta={handleIniciarConsulta}
                onAbrirExpediente={handleAbrirExpediente}
                onRefrescar={() => refrescarAgenda()}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-xs">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <CalendarX2 size={24} />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-800">Sin citas para esta fecha</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {esMedico
                    ? 'No tienes citas asignadas para este día. Contacta a recepción si necesitas agendar.'
                    : `El ${medicoSeleccionado.nombre} no tiene citas asignadas para este día en la base de datos.`}
                </p>
                {puedeGestionar && (
                  <button
                    type="button"
                    onClick={() => openModal('Nueva cita')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    <CalendarPlus size={14} />
                    Agendar o derivar paciente
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Columna Derecha: Panel Principal de Paciente y Consulta (8 columnas) */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-5">
            {citaActiva ? (
              <>
                {/* 1. Header del Paciente Activo */}
                <PacienteHeader
                  cita={citaActiva}
                  onImprimirHistorial={() => {
                    notify(`Generando reporte impreso para ${citaActiva.pacienteNombre}...`)
                    window.print()
                  }}
                  onAlertaUrgencias={() => {
                    notify(`¡Alerta de Urgencias activada para ${citaActiva.pacienteNombre}!`)
                  }}
                />

                {/* 2. Tarjetas de Signos Vitales y Somatometría */}
                <SignosVitalesWidget
                  signos={signosVitales}
                  onActualizarSignos={(nuevos) => {
                    setSignosVitales(nuevos)
                    notify('Signos vitales actualizados en tiempo real')
                  }}
                />

                {/* 3. Consultas Previas y Medicamentos Activos */}
                <AntecedentesMedicamentos
                  consultasPrevias={citaActiva.consultasPrevias}
                  medicamentosActivos={citaActiva.medicamentosActivos}
                />

                {/* 4. Expediente Digital e Importación de Estudios */}
                <ExpedienteDigital archivosIniciales={citaActiva.archivosEstudios} />

                {/* 5. Consulta en Curso: Formato SOAP */}
                <ConsultaSoap soap={soap} onChangeSoap={setSoap} />

                {/* 6. Emisión de Receta y Prescripción Electrónica */}
                <PrescripcionReceta
                  prescripciones={prescripciones}
                  onActualizarPrescripciones={setPrescripciones}
                />

                {/* 7. Footer de Finalización y Firma Electrónica */}
                <ConsultaFooter
                  guardando={guardando}
                  onGuardarBorrador={handleGuardarBorrador}
                  onConcluirYFirmar={handleConcluirYFirmar}
                />
              </>
            ) : (
              <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-xs">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                  <CalendarPlus size={28} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-700">Agenda libre</h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  {esMedico
                    ? 'No tienes pacientes en sala de espera. Tu agenda se actualizará automáticamente cuando recepción te asigne un paciente.'
                    : 'No hay ningún paciente en sala de espera en este momento. La recepcionista puede registrar una cita desde el botón "Nueva cita" o desde el panel de recepción.'}
                </p>
                {puedeGestionar && (
                  <button
                    type="button"
                    onClick={() => openModal('Nueva cita')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                  >
                    <CalendarPlus size={14} className="text-blue-600" />
                    Asignar paciente a este médico
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </section>
  )
}
