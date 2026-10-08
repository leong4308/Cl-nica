/**
 * Carpeta de la opción "Preferencias" del menú de usuario.
 *
 * ESTADO: la opción existe, pero TODAVÍA NO TIENE MODAL PROPIO.
 *
 * Sale de `datos-encabezado.ts` → `opcionesMenuUsuario`, con
 * `modal: 'Preferencias'`. Hoy `openModal()` de `app/page.tsx` la ignora
 * porque no está en `MODALES_CON_FORMULARIO`, así que pulsarla no abre nada.
 *
 * PARA IMPLEMENTARLO, aquí deben vivir:
 *   1. `modal-preferencias.tsx` con la carcasa `ModalMarco`.
 *   2. El guardado de preferencias (tema, idioma, avisos) en `lib/supabase/datos.ts`.
 *   3. Registrar `'Preferencias'` en `MODALES_CON_FORMULARIO`.
 */
export {}
