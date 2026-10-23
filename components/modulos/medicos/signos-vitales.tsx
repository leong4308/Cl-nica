'use client'

import { useState } from 'react'
import { Activity, Heart, Thermometer, Weight, TrendingUp, Edit2, Check, X } from 'lucide-react'
import type { SignosVitales } from './types'

type SignosVitalesProps = {
  signos?: SignosVitales
  onActualizarSignos?: (nuevos: SignosVitales) => void
}

export function SignosVitalesWidget({
  signos: signosIniciales,
  onActualizarSignos,
}: SignosVitalesProps) {
  const [editando, setEditando] = useState(false)
  const [valores, setValores] = useState<SignosVitales>(
    signosIniciales || {
      presionArterial: '142/90',
      presionComparativa: 'Elevada vs anterior (135/85)',
      presionAlerta: true,
      frecuenciaCardiaca: 76,
      frecuenciaRitmo: 'Ritmo sinusal regular',
      spo2: 98,
      temperatura: 36.6,
      temperaturaEstado: 'Normal eutérmico',
      peso: 84.2,
      imc: 27.5,
      imcClasificacion: 'Sobrepeso G1',
    }
  )

  const handleGuardar = () => {
    setEditando(false)
    if (onActualizarSignos) {
      onActualizarSignos(valores)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Signos Vitales y Somatometría
        </h3>

        <button
          type="button"
          onClick={() => setEditando(!editando)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          {editando ? (
            <>
              <X size={13} /> Cancelar
            </>
          ) : (
            <>
              <Edit2 size={13} /> Editar Signos
            </>
          )}
        </button>
      </div>

      {editando ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="text-[11px] font-bold text-slate-700">Presión Arterial (mmHg)</label>
              <input
                type="text"
                value={valores.presionArterial}
                onChange={(e) => setValores({ ...valores, presionArterial: e.target.value })}
                placeholder="120/80"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700">Frec. Cardíaca (lpm)</label>
              <input
                type="number"
                value={valores.frecuenciaCardiaca}
                onChange={(e) => setValores({ ...valores, frecuenciaCardiaca: Number(e.target.value) })}
                placeholder="75"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700">SpO2 (%) & Temp (°C)</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  value={valores.spo2}
                  onChange={(e) => setValores({ ...valores, spo2: Number(e.target.value) })}
                  placeholder="98"
                  className="w-1/2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold focus:border-blue-500 focus:outline-hidden"
                />
                <input
                  type="number"
                  step="0.1"
                  value={valores.temperatura}
                  onChange={(e) => setValores({ ...valores, temperatura: Number(e.target.value) })}
                  placeholder="36.5"
                  className="w-1/2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700">Peso (kg) & IMC</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={valores.peso}
                  onChange={(e) => setValores({ ...valores, peso: Number(e.target.value) })}
                  placeholder="80"
                  className="w-1/2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold focus:border-blue-500 focus:outline-hidden"
                />
                <input
                  type="number"
                  step="0.1"
                  value={valores.imc}
                  onChange={(e) => setValores({ ...valores, imc: Number(e.target.value) })}
                  placeholder="25.0"
                  className="w-1/2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleGuardar}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              <Check size={14} /> Aplicar cambios
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Presión Arterial */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-200">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">Presión Arterial</span>
              <Activity size={14} className="text-rose-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                {valores.presionArterial}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">mmHg</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-rose-600">
              <TrendingUp size={11} />
              <span className="truncate">{valores.presionComparativa || 'Estable'}</span>
            </div>
          </div>

          {/* Frecuencia Cardíaca */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-200">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">Frec. Cardíaca</span>
              <Heart size={14} className="text-rose-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                {valores.frecuenciaCardiaca}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">lpm</span>
            </div>
            <div className="mt-2 text-[10px] font-semibold text-emerald-600">
              {valores.frecuenciaRitmo || 'Ritmo regular'}
            </div>
          </div>

          {/* SpO2 & Temperatura */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-200">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">SpO2 & Temp</span>
              <Thermometer size={14} className="text-blue-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black tracking-tight text-slate-900 font-mono">
                {valores.spo2}%
              </span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xl font-black tracking-tight text-slate-900 font-mono">
                {valores.temperatura}°C
              </span>
            </div>
            <div className="mt-2 text-[10px] font-semibold text-blue-600">
              {valores.temperaturaEstado || 'Normal eutérmico'}
            </div>
          </div>

          {/* IMC & Peso */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-200">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">IMC & Peso</span>
              <Weight size={14} className="text-indigo-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black tracking-tight text-slate-900 font-mono">
                {valores.peso} kg
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                (IMC {valores.imc})
              </span>
            </div>
            <div className="mt-2 text-[10px] font-semibold text-amber-600">
              {valores.imcClasificacion || 'Sobrepeso G1'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
