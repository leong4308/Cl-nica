'use client'

import { useState } from 'react'
import { FileEdit, ShieldCheck, Plus, X, Search, Sparkles } from 'lucide-react'
import type { DiagnosticoCie10 } from './types'
import { CATALOGO_CIE10 } from './datos-medicos'

type ConsultaSoapProps = {
  soap: {
    subjetivo: string
    objetivo: string
    diagnosticos: DiagnosticoCie10[]
    plan: string
  }
  onChangeSoap: (soap: {
    subjetivo: string
    objetivo: string
    diagnosticos: DiagnosticoCie10[]
    plan: string
  }) => void
}

export function ConsultaSoap({ soap, onChangeSoap }: ConsultaSoapProps) {
  const [busquedaCie, setBusquedaCie] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)

  const handleSubjetivoChange = (val: string) => {
    onChangeSoap({ ...soap, subjetivo: val })
  }

  const handleObjetivoChange = (val: string) => {
    onChangeSoap({ ...soap, objetivo: val })
  }

  const handlePlanChange = (val: string) => {
    onChangeSoap({ ...soap, plan: val })
  }

  const handleAgregarDiagnostico = (cie: { codigo: string; descripcion: string }) => {
    if (soap.diagnosticos.some((d) => d.codigo === cie.codigo)) return

    const nuevo: DiagnosticoCie10 = {
      codigo: cie.codigo,
      descripcion: cie.descripcion,
      tipo: soap.diagnosticos.length === 0 ? 'Principal' : 'Secundario',
    }

    onChangeSoap({
      ...soap,
      diagnosticos: [...soap.diagnosticos, nuevo],
    })
    setBusquedaCie('')
    setMostrarBuscador(false)
  }

  const handleEliminarDiagnostico = (codigo: string) => {
    const filtrados = soap.diagnosticos.filter((d) => d.codigo !== codigo)
    // Asegurar que el primero restante sea Principal
    if (filtrados.length > 0 && filtrados[0].tipo !== 'Principal') {
      filtrados[0].tipo = 'Principal'
    }
    onChangeSoap({ ...soap, diagnosticos: filtrados })
  }

  const sugerencias = CATALOGO_CIE10.filter(
    (item) =>
      item.codigo.toLowerCase().includes(busquedaCie.toLowerCase()) ||
      item.descripcion.toLowerCase().includes(busquedaCie.toLowerCase())
  )

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      {/* Header SOAP */}
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <FileEdit size={14} />
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            Consulta en Curso: Formato SOAP
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Guardado automático activo cada 30 segundos
        </div>
      </div>

      {/* Grid 2x2 Formato SOAP */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        
        {/* S - Subjetivo */}
        <div className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-500/20">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              S • Subjetivo (Motivo y Anamnesis)
            </label>
            <span className="text-[10px] text-slate-400 font-medium">Relato del paciente</span>
          </div>
          <textarea
            rows={4}
            value={soap.subjetivo}
            onChange={(e) => handleSubjetivoChange(e.target.value)}
            placeholder="Describa el motivo de consulta, evolución, síntomas referidos y molestias actuales..."
            className="w-full resize-none bg-transparent text-xs text-slate-700 leading-relaxed placeholder:text-slate-400 focus:outline-hidden"
          />
        </div>

        {/* O - Objetivo */}
        <div className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-500/20">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              O • Objetivo (Examen Físico y Hallazgos)
            </label>
            <span className="text-[10px] text-slate-400 font-medium">Exploración clínica</span>
          </div>
          <textarea
            rows={4}
            value={soap.objetivo}
            onChange={(e) => handleObjetivoChange(e.target.value)}
            placeholder="Auscultación cardíaca/pulmonar, palpación abdominal, estado neurológico, edemas..."
            className="w-full resize-none bg-transparent text-xs text-slate-700 leading-relaxed placeholder:text-slate-400 focus:outline-hidden"
          />
        </div>

        {/* A - Análisis (Diagnósticos CIE-10) */}
        <div className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-500/20">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              A • Análisis (Diagnóstico Clínico CIE-10)
            </label>
            <button
              type="button"
              onClick={() => setMostrarBuscador(!mostrarBuscador)}
              className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
            >
              <Plus size={12} /> Añadir CIE-10
            </button>
          </div>

          {/* Buscador CIE-10 */}
          {mostrarBuscador && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
              <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1">
                <Search size={13} className="text-slate-400" />
                <input
                  type="text"
                  value={busquedaCie}
                  onChange={(e) => setBusquedaCie(e.target.value)}
                  placeholder="Buscar código CIE-10 o patología..."
                  className="w-full text-xs focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                {sugerencias.length === 0 ? (
                  <p className="p-2 text-[11px] text-slate-400">Sin coincidencias en catálogo rápido</p>
                ) : (
                  sugerencias.map((item) => (
                    <button
                      key={item.codigo}
                      type="button"
                      onClick={() => handleAgregarDiagnostico(item)}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-blue-50"
                    >
                      <span className="font-mono font-bold text-slate-800">[{item.codigo}]</span>
                      <span className="ml-2 flex-1 truncate text-slate-600">{item.descripcion}</span>
                      <Plus size={12} className="text-blue-600" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Badges de Diagnósticos Seleccionados */}
          <div className="space-y-2">
            {soap.diagnosticos.map((d) => (
              <div
                key={d.codigo}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-blue-700">[{d.codigo}]</span>
                  <span className="truncate text-slate-800 font-medium">{d.descripcion}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      d.tipo === 'Principal'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {d.tipo}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleEliminarDiagnostico(d.codigo)}
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  title="Remover diagnóstico"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* P - Plan Médico & Conducta */}
        <div className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-500/20">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              P • Plan Médico & Conducta
            </label>
            <span className="text-[10px] text-slate-400 font-medium">Tratamiento e indicaciones</span>
          </div>
          <textarea
            rows={4}
            value={soap.plan}
            onChange={(e) => handlePlanChange(e.target.value)}
            placeholder="1. Medidas dietéticas y estilo de vida&#10;2. Solicitud de análisis o gabinete&#10;3. Criterios de reevaluación..."
            className="w-full resize-none bg-transparent text-xs text-slate-700 leading-relaxed placeholder:text-slate-400 focus:outline-hidden"
          />
        </div>

      </div>
    </div>
  )
}
