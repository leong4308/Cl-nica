export function BotonOlvidoContrasena({ onAvisar }: { onAvisar: (mensaje: string) => void }) {
  return (
    <button type="button" onClick={() => onAvisar('Solicita el restablecimiento al administrador del sistema.')} className="font-medium text-[#1a56db] hover:underline">
      ¿Olvidaste tu contraseña?
    </button>
  )
}
