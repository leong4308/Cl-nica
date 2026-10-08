/**
 * Carpeta del botón "Configuración".
 *
 * ESTADO: el botón existe, pero TODAVÍA NO TIENE MODAL PROPIO.
 *
 * Se llama desde DOS sitios con el mismo título `'Configuración'`:
 *   - `barra-lateral/navegacion/items-menu.ts` → `itemsAdministracion` (solo admin)
 *   - `barra-superior/datos-encabezado.ts` → `opcionesMenuUsuario`
 * por eso vive en `compartidos/` y no dentro de ninguna de las dos barras.
 *
 * Hoy `openModal()` de `app/page.tsx` lo ignora porque no está en
 * `MODALES_CON_FORMULARIO`, así que pulsarlo no abre nada. Este archivo existe
 * para que la carpeta quede registrada en git y el hueco sea visible.
 *
 * PARA IMPLEMENTARLO, aquí deben vivir:
 *   1. `modal-configuracion.tsx` con la carcasa `ModalMarco`
 *      (components/modulos/compartidos/modal-marco.tsx).
 *   2. Los datos clínicos ajustables (horarios, notificaciones, etc.).
 *   3. Registrar `'Configuración'` en `MODALES_CON_FORMULARIO` (app/page.tsx)
 *      y despacharlo desde el bloque de modales.
 */
export {}
