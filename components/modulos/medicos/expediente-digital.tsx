'use client'

import { useState } from 'react'
import { UploadCloud, FileText, FileSpreadsheet, Eye, Download, Trash2, Shield, RefreshCw } from 'lucide-react'
import type { ArchivoEstudio } from './types'

type ExpedienteDigitalProps = {
  archivosIniciales?: ArchivoEstudio[]
}

export function ExpedienteDigital({ archivosIniciales = [] }: ExpedienteDigitalProps) {
  const [archivos, setArchivos] = useState<ArchivoEstudio[]>(archivosIniciales)
  const [arrastrando, setArrastrando] = useState(false)

  const handleSubirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const nuevo: ArchivoEstudio = {
      id: `file-${Date.now()}`,
      nombre: files[0].name,
      tipo: files[0].name.endsWith('.pdf') ? 'pdf' : files[0].name.endsWith('.xlsx') ? 'xlsx' : 'docx',
      origen: 'Subido localmente en consulta actual',
      tamano: `${(files[0].size / (1024 * 1024)).toFixed(1)} MB`,
      fecha: 'Hoy',
    }

    setArchivos([nuevo, ...archivos])
  }

  const handleEliminar = (id: string) => {
    setArchivos(archivos.filter((a) => a.id !== id))
  }

  const iconoPorTipo = (tipo: ArchivoEstudio['tipo']) => {
    switch (tipo) {
      case 'xlsx':
        return <FileSpreadsheet className="text-emerald-600" size={16} />
      case 'pdf':
        return <FileText className="text-rose-600" size={16} />
      case 'docx':
        return <FileText className="text-blue-600" size={16} />
      default:
        return <FileText className="text-slate-600" size={16} />
    }
  }

  const badgeColorPorTipo = (tipo: ArchivoEstudio['tipo']) => {
    switch (tipo) {
      case 'xlsx':
        return 'bg-emerald-50 text-emerald-700'
      case 'pdf':
        return 'bg-rose-50 text-rose-700'
      case 'docx':
        return 'bg-blue-50 text-blue-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      {/* Header */}
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Expediente Digital e Importación de Estudios Previos
            </h3>
            <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700">
              <Shield size={10} /> Integración HL7/FHIR
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Vincula estudios externos, notas laboratoriales y notas clínicas históricas
          </p>
        </div>
      </div>

      {/* Zona Drag & Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          if (e.dataTransfer.files.length > 0) {
            const f = e.dataTransfer.files[0]
            const nuevo: ArchivoEstudio = {
              id: `file-${Date.now()}`,
              nombre: f.name,
              tipo: f.name.endsWith('.pdf') ? 'pdf' : f.name.endsWith('.xlsx') ? 'xlsx' : 'docx',
              origen: 'Importado por arrastre en consulta',
              tamano: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
              fecha: 'Hoy',
            }
            setArchivos([nuevo, ...archivos])
          }
        }}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
          arrastrando
            ? 'border-blue-500 bg-blue-50/50'
            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-blue-100/70 text-blue-600">
          <UploadCloud size={22} />
        </div>

        <p className="mt-2 text-xs font-bold text-slate-800">
          Arrastre y suelte aquí archivos del historial o estudios previos
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Compatible para indexación automática de tablas de signos, informes diagnósticos externos y biometrías.
        </p>

        {/* Formatos admitidos */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-2xs border border-slate-100">
            📄 Word (.docx, .doc)
          </span>
          <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-2xs border border-slate-100">
            📊 Excel (.xlsx, .xls)
          </span>
          <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-2xs border border-slate-100">
            📑 PDF (Estudios/TAC/Eco)
          </span>
          <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-2xs border border-slate-100">
            🩻 DICOM
          </span>
        </div>

        {/* Botón Explorar */}
        <label className="mt-3.5 inline-flex cursor-pointer items-center rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700">
          Examinar Archivos
          <input
            type="file"
            onChange={handleSubirArchivo}
            className="hidden"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.dcm"
          />
        </label>
      </div>

      {/* Lista de Archivos Vinculados */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span>ARCHIVOS DIGITALES VINCULADOS ({archivos.length} DOCUMENTOS PROCESADOS)</span>
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline lowercase"
          >
            <RefreshCw size={11} /> Sincronizar repositorio externo
          </button>
        </div>

        <div className="space-y-2">
          {archivos.map((arc) => (
            <div
              key={arc.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition hover:bg-slate-50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex size-7 items-center justify-center rounded-lg bg-white shadow-2xs">
                  {iconoPorTipo(arc.tipo)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-bold text-slate-800 font-mono">
                      {arc.nombre}
                    </p>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide ${badgeColorPorTipo(
                        arc.tipo
                      )}`}
                    >
                      {arc.tipo}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-500">
                    {arc.origen} • {arc.tamano}
                  </p>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Ver documento"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
                  onClick={() => alert(`Previsualizando ${arc.nombre}`)}
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  title="Descargar archivo"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                  onClick={() => alert(`Descargando ${arc.nombre}`)}
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  title="Desvincular archivo"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  onClick={() => handleEliminar(arc.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
