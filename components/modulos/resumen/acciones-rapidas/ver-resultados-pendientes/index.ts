/**
 * Carpeta del botón "Ver resultados pendientes" (acciones rápidas del dashboard).
 *
 * ESTADO: el botón existe y navega, pero TODAVÍA NO TIENE MODAL PROPIO.
 *
 * Hoy `openModal()` de `app/page.tsx` ignora este título porque no está en
 * `MODALES_CON_FORMULARIO`, así que pulsarlo no abre nada. Este archivo existe
 * para que la carpeta quede registrada en git y el hueco sea visible.
 *
 * PARA IMPLEMENTARLO, aquí deben vivir:
 *   1. `modal-resultados-pendientes.tsx` con la carcasa `ModalMarco`
 *      (components/modulos/compartidos/modal-marco.tsx).
 *   2. La lista de resultados de laboratorio con estado pendiente, leída de
 *      Supabase a través de `lib/supabase/datos.ts`.
 *   3. Registrar 'Ver resultados pendientes' en `MODALES_CON_FORMULARIO`
 *      (app/page.tsx) y despacharlo desde el bloque de modales.
 *
 * Referencia del módulo del que salen los datos:
 * components/modulos/compartidos/data.ts → `Laboratorio`.
 */
export {}
