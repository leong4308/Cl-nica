/**
 * Carpeta del botón "Registrar paciente" (acciones rápidas del dashboard).
 *
 * ESTADO: el botón existe y navega, pero TODAVÍA NO TIENE MODAL PROPIO.
 *
 * Hoy `openModal()` de `app/page.tsx` ignora este título porque no está en
 * `MODALES_CON_FORMULARIO`, así que pulsarlo no abre nada. Este archivo existe
 * para que la carpeta quede registrada en git y el hueco sea visible.
 *
 * PARA IMPLEMENTARLO, aquí deben vivir:
 *   1. `modal-registrar-paciente.tsx` con la carcasa `ModalMarco`
 *      (components/modulos/compartidos/modal-marco.tsx).
 *   2. El formulario con nombre, identificación, teléfono, nacimiento, etc.
 *   3. La escritura en la tabla `perfiles_pacientes` vía `lib/supabase/datos.ts`.
 *   4. Registrar `'Registrar paciente'` en `MODALES_CON_FORMULARIO`
 *      (app/page.tsx) y despacharlo desde el bloque de modales.
 *
 * No confundir con "Nuevo paciente", que es la acción del módulo Pacientes
 * (components/modulos/compartidos/data.ts) y abre otra cosa.
 */
export {}
