'use client'

import { useState } from 'react'
import { CheckCircle2, Save, Send, Loader2 } from 'lucide-react'

type ConsultaFooterProps = {
  guardando: boolean
  onGuardarBorrador: () => void
  onConcluirYFirmar: () => void
}

export function ConsultaFooter({
  guardando,
  onGuardarBorrador,
  onConcluirYFirmar,
}: ConsultaFooterProps) {
  const [notificarPortal, setNotificarPortal] = useState(true)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        
        {/* Aviso de portal paciente */}
        <label className="flex items-center gap-2.5 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={notificarPortal}
            onChange={(e) => setNotificarPortal(e.target.checked)}
            className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="flex items-center gap-1.5 font-medium">
            <Send size={13} className="text-blue-500" />
            La receta y notas se enviarán automáticamente al portal del paciente tras finalizar
          </span>
        </label>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={guardando}
            onClick={onGuardarBorrador}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <Save size={14} className="text-slate-500" />
            Guardar Borrador
          </button>

          <button
            type="button"
            disabled={guardando}
            onClick={onConcluirYFirmar}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition"
          >
            {guardando ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Firmando y guardando...
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                Concluir Consulta y Firmar Receta
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
