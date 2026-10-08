/**
 * Carpeta de la opción "Cambiar contraseña" del menú de usuario.
 *
 * ESTADO: la opción existe, pero TODAVÍA NO TIENE MODAL PROPIO.
 *
 * Sale de `datos-encabezado.ts` → `opcionesMenuUsuario`, con
 * `modal: 'Cambiar contraseña'`. Hoy `openModal()` de `app/page.tsx` la ignora
 * porque no está en `MODALES_CON_FORMULARIO`, así que pulsarla no abre nada.
 *
 * PARA IMPLEMENTARLO, aquí deben vivir:
 *   1. `modal-cambiar-contrasena.tsx` con la carcasa `ModalMarco`.
 *   2. La llamada a `supabase.auth.updateUser({ password })`.
 *   3. Registrar `'Cambiar contraseña'` en `MODALES_CON_FORMULARIO`.
 */
export {}
