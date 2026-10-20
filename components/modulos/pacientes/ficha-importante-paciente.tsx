'use client'

import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Droplet,
  Heart,
  Pill,
  Save,
  Scale,
  ShieldAlert,
  Thermometer,
  Wind,
  X,
  Edit3,
} from 'lucide-react'
import {
  guardarFichaImportante,
  parsearFichaImportante,
  type FichaImportante,
} from '@/lib/supabase/datos'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'

type PropsFichaImportante = {
  pacienteId: number
  notasMedicasRaw?: string
  rol?: RolUsuario
  usuarioNombre?: string
  onActualizado?: (nuevaFicha: FichaImportante) => void
  modoCompacto?: boolean
}

export function FichaImportantePaciente({
  pacienteId,
  notasMedicasRaw,
  rol,
  usuarioNombre,
  onActualizado,
  modoCompacto = false,
}: PropsFichaImportante) {
  const [ficha, setFicha] = useState<FichaImportante>(() => parsearFichaImportante(notasMedicasRaw))
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  // Campos de formulario
  const [alergias, setAlergias] = useState(ficha.alergias ?? '')
  const [tipoSangre, setTipoSangre] = useState(ficha.tipoSangre ?? '')
  const [condiciones, setCondiciones] = useState(ficha.condicionesCronicas ?? '')
  const [medicamento, setMedicamento] = useState(ficha.medicamentoActual ?? '')

  // Signos vitales
  const [pa, setPa] = useState(ficha.signosVitales?.presionArterial ?? '')
  const [fc, setFc] = useState(ficha.signosVitales?.frecuenciaCardiaca ?? '')
  const [temp, setTemp] = useState(ficha.signosVitales?.temperatura ?? '')
  const [spo2, setSpo2] = useState(ficha.signosVitales?.saturacionOxigeno ?? '')
  const [peso, setPeso] = useState(ficha.signosVitales?.peso ?? '')
  const [glucosa, setGlucosa] = useState(ficha.signosVitales?.glucosa ?? '')

  const abrirEdicion = () => {
    setAlergias(ficha.alergias ?? '')
    setTipoSangre(ficha.tipoSangre ?? '')
    setCondiciones(ficha.condicionesCronicas ?? '')
    setMedicamento(ficha.medicamentoActual ?? '')
    setPa(ficha.signosVitales?.presionArterial ?? '')
    setFc(ficha.signosVitales?.frecuenciaCardiaca ?? '')
    setTemp(ficha.signosVitales?.temperatura ?? '')
    setSpo2(ficha.signosVitales?.saturacionOxigeno ?? '')
    setPeso(ficha.signosVitales?.peso ?? '')
    setGlucosa(ficha.signosVitales?.glucosa ?? '')
    setError('')
    setEditando(true)
  }

  const guardar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setGuardando(true)
    setError('')

    const rolTexto = rol === 'enfermero' ? 'Enfermería' : rol === 'medico' ? 'Médico' : 'Clínica'
    const nombreRegistrador = usuarioNombre ? `${usuarioNombre} (${rolTexto})` : rolTexto

    const ahora = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const signosActualizados = (pa || fc || temp || spo2 || peso || glucosa) ? {
      presionArterial: pa.trim() || undefined,
      frecuenciaCardiaca: fc.trim() || undefined,
      temperatura: temp.trim() || undefined,
      saturacionOxigeno: spo2.trim() || undefined,
      peso: peso.trim() || undefined,
      glucosa: glucosa.trim() || undefined,
      tomadoPor: nombreRegistrador,
      fechaHora: ahora,
    } : undefined

    const nuevaFicha: FichaImportante = {
      alergias: alergias.trim() || undefined,
      tipoSangre: tipoSangre.trim() || undefined,
      condicionesCronicas: condiciones.trim() || undefined,
      medicamentoActual: medicamento.trim() || undefined,
      signosVitales: signosActualizados ?? ficha.signosVitales,
    }

    const { ok, error: errGuardar } = await guardarFichaImportante(pacienteId, nuevaFicha)
    setGuardando(false)

    if (!ok || errGuardar) {
      setError(errGuardar || 'No se pudo guardar la información')
      return
    }

    setFicha(nuevaFicha)
    setEditando(false)
    setMensaje('Signos y alertas actualizados correctamente')
    setTimeout(() => setMensaje(''), 3000)

    if (onActualizado) onActualizado(nuevaFicha)
    window.dispatchEvent(new CustomEvent('datos-actualizados'))
  }

  const sv = ficha.signosVitales
  const haySignos = Boolean(
    sv?.presionArterial || sv?.frecuenciaCardiaca || sv?.temperatura || sv?.saturacionOxigeno || sv?.peso || sv?.glucosa
  )

  return (
    <div className="space-y-4">
      {/* Mensajes de aviso */}
      {mensaje && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          {mensaje}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
          <ShieldAlert size={16} className="text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      {/* MODO VISTA NORMAL */}
      {!editando && (
        <div className="space-y-4">
          {/* 1. Alertas de Seguridad Inmediata */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <AlertTriangle size={15} className="text-amber-500" />
                Alertas de Seguridad Clínica
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={abrirEdicion}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 active:scale-95 transition-all"
                >
                  <Activity size={13} />
                  Tomar signos vitales
                </button>
                <button
                  type="button"
                  onClick={abrirEdicion}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 active:scale-95 transition-all"
                >
                  <Edit3 size={13} />
                  Editar signos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Alergias */}
              <div
                className={`rounded-xl border p-3 ${ficha.alergias
                  ? 'border-rose-200 bg-rose-50/80 text-rose-900'
                  : 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                  }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">Alergias</p>
                <p className="mt-1 text-xs font-bold leading-snug">
                  {ficha.alergias ? `⚠️ ${ficha.alergias}` : '✓ Sin alergias reportadas'}
                </p>
              </div>

              {/* Tipo de sangre */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-blue-950">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1">
                  <Droplet size={12} />
                  Grupo Sanguíneo
                </p>
                <p className="mt-1 text-sm font-black">{ficha.tipoSangre || 'No registrado'}</p>
              </div>

              {/* Padecimientos crónicos */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3 text-purple-950">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Padecimientos Crónicos</p>
                <p className="mt-1 text-xs font-semibold leading-snug">
                  {ficha.condicionesCronicas || 'Ninguno reportado'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Signos Vitales Recientes (Triage) - Solo se muestra si hay signos tomados */}
          {haySignos && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Activity size={15} className="text-teal-600" />
                  Signos Vitales Recientes (Triage)
                </span>
                {sv?.fechaHora && (
                  <span className="text-[11px] font-medium text-slate-500">
                    {sv.fechaHora}
                  </span>
                )}
              </div>

              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* PA */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <Heart size={11} className="text-rose-500" />
                      Presión
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{sv?.presionArterial || '—'}</p>
                    <p className="text-[9px] text-slate-400">mmHg</p>
                  </div>

                  {/* FC */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <Activity size={11} className="text-blue-500" />
                      Pulso / FC
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{sv?.frecuenciaCardiaca || '—'}</p>
                    <p className="text-[9px] text-slate-400">lpm</p>
                  </div>

                  {/* Temp */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <Thermometer size={11} className="text-amber-500" />
                      Temperatura
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{sv?.temperatura || '—'}</p>
                    <p className="text-[9px] text-slate-400">°C</p>
                  </div>

                  {/* SpO2 */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <Wind size={11} className="text-cyan-500" />
                      SpO2
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{sv?.saturacionOxigeno || '—'}</p>
                    <p className="text-[9px] text-slate-400">%</p>
                  </div>

                  {/* Glucosa */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <Droplet size={11} className="text-indigo-500" />
                      Glucosa
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{sv?.glucosa || '—'}</p>
                    <p className="text-[9px] text-slate-400">mg/dL</p>
                  </div>

                  {/* Peso */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <Scale size={11} className="text-emerald-500" />
                      Peso
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{sv?.peso || '—'}</p>
                    <p className="text-[9px] text-slate-400">kg</p>
                  </div>
                </div>

                {sv?.tomadoPor && (
                  <p className="mt-3 text-[11px] text-slate-400 text-right">
                    Tomado por: <span className="font-semibold text-slate-600">{sv.tomadoPor}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 3. Medicación / Tratamiento actual */}
          {ficha.medicamentoActual && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                <Pill size={14} className="text-emerald-600" />
                Medicamento / Tratamiento en Curso
              </span>
              <p className="mt-2.5 text-xs font-medium text-slate-800 leading-relaxed bg-emerald-50/40 border border-emerald-100 rounded-xl p-3">
                {ficha.medicamentoActual}
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODO FORMULARIO / EDICIÓN (Médico o Enfermero) */}
      {editando && (
        <form onSubmit={guardar} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Edit3 size={14} className="text-blue-600" />
                Registro de Signos Vitales y Alertas
              </h4>
              <p className="text-[11px] text-slate-400">Disponible para toma por Enfermería o Médico tratante</p>
            </div>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>

          {/* Bloque A: Signos Vitales */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Activity size={13} className="text-teal-600" />
              Signos Vitales del Paciente
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Presión Arterial (PA)</label>
                <input
                  type="text"
                  placeholder="ej. 120/80"
                  value={pa}
                  onChange={(e) => setPa(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Frec. Cardíaca (lpm)</label>
                <input
                  type="text"
                  placeholder="ej. 78"
                  value={fc}
                  onChange={(e) => setFc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Temperatura (°C)</label>
                <input
                  type="text"
                  placeholder="ej. 36.6"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Oxígeno SpO2 (%)</label>
                <input
                  type="text"
                  placeholder="ej. 98"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Glucosa (mg/dL)</label>
                <input
                  type="text"
                  placeholder="ej. 95"
                  value={glucosa}
                  onChange={(e) => setGlucosa(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Peso (kg)</label>
                <input
                  type="text"
                  placeholder="ej. 68.5"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bloque B: Alertas y Antecedentes */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <AlertTriangle size={13} className="text-amber-500" />
              Alertas y Datos Críticos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Alergias conocidas</label>
                <input
                  type="text"
                  placeholder="ej. Penicilina, Sulfas (o dejar vacío si no tiene)"
                  value={alergias}
                  onChange={(e) => setAlergias(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Tipo de Sangre y Factor Rh</label>
                <input
                  type="text"
                  placeholder="ej. O+, A+, B-, etc."
                  value={tipoSangre}
                  onChange={(e) => setTipoSangre(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500">Padecimientos Crónicos o Condiciones de Riesgo</label>
              <input
                type="text"
                placeholder="ej. Hipertensión arterial, Diabetes mellitus tipo 2, Anticoagulado"
                value={condiciones}
                onChange={(e) => setCondiciones(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500">Medicamentos o Tratamiento Actual</label>
              <input
                type="text"
                placeholder="ej. Losartán 50mg cada 12h, Metformina 850mg"
                value={medicamento}
                onChange={(e) => setMedicamento(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={13} />
              {guardando ? 'Guardando…' : 'Guardar información'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
