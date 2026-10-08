/**
 * Carpeta del botón "Nuevo paciente" (pestaña Pacientes).
 *
 * ESTADO: el botón existe, pero TODAVÍA NO TIENE MODAL PROPIO.
 *
 * Es el `action` de la entrada `Pacientes` en
 * `citas/configuracion-modulos.ts`: `module-page.tsx` lo pinta como botón
 * principal y llama a `openModal('Nuevo paciente')`. Hoy `openModal()` de
 * `app/page.tsx` lo ignora porque no está en `MODALES_CON_FORMULARIO`,
 * así que pulsarlo no abre nada.
 *
 * PARA IMPLEMENTARLO, aquí deben vivir:
 *   1. `modal-nuevo-paciente.tsx` con la carcasa `ModalMarco`.
 *   2. El formulario y la escritura en Supabase.
 *   3. Registrar `'Nuevo paciente'` en `MODALES_CON_FORMULARIO` (app/page.tsx).
 */
export {}
