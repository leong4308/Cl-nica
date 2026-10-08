/**
 * Botón "¿Olvidaste tu contraseña?" del login.
 *
 * Vive en `login/olvido-contrasena/` porque es donde se pinta
 * (`login-form.tsx`): no abre modal, solo muestra el aviso de contactar
 * al administrador del sistema.
 */
export function BotonOlvidoContrasena({ onAvisar }: { onAvisar: (mensaje: string) => void }) {
  return (
    <button type="button" onClick={() => onAvisar('Solicita el restablecimiento al administrador del sistema.')} className="font-medium text-[#1a56db] hover:underline">
      ¿Olvidaste tu contraseña?
    </button>
  )
}
