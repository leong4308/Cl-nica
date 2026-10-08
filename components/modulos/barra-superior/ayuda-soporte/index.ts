/**
 * Carpeta de la opción "Ayuda y soporte" del menú de usuario.
 *
 * ESTADO: la opción existe, pero TODAVÍA NO TIENE MODAL PROPIO.
 *
 * Se llama con `modal: 'Ayuda'` desde `datos-encabezado.ts` →
 * `opcionesMenuUsuario`. Hoy `openModal()` de `app/page.tsx` la ignora porque
 * `'Ayuda'` no está en `MODALES_CON_FORMULARIO`, así que pulsarla no abre nada.
 * La carpeta toma el nombre del botón ("Ayuda y soporte"), no el del modal.
 *
 * PARA IMPLEMENTARLO, aquí deben vivir:
 *   1. `modal-ayuda.tsx` con la carcasa `ModalMarco`.
 *   2. FAQ / contacto de soporte.
 *   3. Registrar `'Ayuda'` en `MODALES_CON_FORMULARIO` (app/page.tsx).
 */
export {}
