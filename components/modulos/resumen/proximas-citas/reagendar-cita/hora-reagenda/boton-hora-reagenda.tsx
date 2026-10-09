export function BotonesHoraReagenda({
  etiquetaDia, slots, hora, onHora,
}: {
  etiquetaDia: string
  slots: string[]
  hora: string
  onHora: (slot: string) => void
}) {
  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hora del {etiquetaDia}</p>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {slots.map((slot) => (
          <button type="button" key={slot} onClick={() => onHora(slot)} aria-pressed={hora === slot} className={`rounded-lg border px-2 py-2 text-xs font-medium ${hora === slot ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'}`}>
            {slot}
          </button>
        ))}
      </div>
    </div>
  )
}
