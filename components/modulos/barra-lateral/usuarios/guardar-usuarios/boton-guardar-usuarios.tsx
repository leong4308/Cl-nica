/**
 * Botón "Guardar" del pie del modal de Usuarios.
 *
 * Vive en `barra-lateral/usuarios/guardar-usuarios/`: se pinta en
 * `modal-usuarios.tsx`. Nota heredada: hoy solo cierra (`onSave('')`);
 * la escritura real la hace `BotonCrearUsuario` del formulario.
 */
export function BotonGuardarUsuarios({ onGuardar }: { onGuardar: () => void }) {
  return (
    <button
      type="button"
      onClick={onGuardar}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
    >
      Guardar
    </button>
  )
}
