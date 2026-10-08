/**
 * Carpeta de la opción "Mi perfil" del menú de usuario (barra superior).
 *
 * ESTADO: la opción existe, pero TODAVÍA NO TIENE MODAL PROPIO.
 *
 * Sale de `datos-encabezado.ts` → `opcionesMenuUsuario`, con `modal: 'Perfil'`.
 * Hoy `openModal()` de `app/page.tsx` lo ignora porque `'Perfil'` no está en
 * `MODALES_CON_FORMULARIO`, así que pulsarlo no abre nada.
 *
 * PARA IMPLEMENTARLO, aquí deben vivir:
 *   1. `modal-perfil.tsx` con la carcasa `ModalMarco`
 *      (components/modulos/compartidos/modal-marco.tsx).
 *   2. Los datos del usuario que trae `lib/supabase/sesion.ts`.
 *   3. Registrar `'Perfil'` en `MODALES_CON_FORMULARIO` (app/page.tsx).
 */
export {}
