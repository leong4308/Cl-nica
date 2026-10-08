/**
 * Botón "Crear usuario" del formulario de Usuarios.
 *
 * Vive en `barra-lateral/usuarios/crear-usuario/`: corre contra
 * `/api/admin/users` (no abre modal). Es quien realmente escribe el
 * usuario nuevo.
 */
export function BotonCrearUsuario({
  guardando, onCrear,
}: {
  guardando: boolean
  onCrear: () => void
}) {
  return (
    <button
      type="button"
      onClick={onCrear}
      disabled={guardando}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      Crear usuario
    </button>
  )
}
