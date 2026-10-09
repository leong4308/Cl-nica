export function BotonVerCamas({ onVerCamas }: { onVerCamas: () => void }) {
  return (
    <button type="button" onClick={onVerCamas} className="mt-4 text-xs font-semibold text-blue-600 hover:underline">
      Ver camas e internaciones →
    </button>
  )
}
