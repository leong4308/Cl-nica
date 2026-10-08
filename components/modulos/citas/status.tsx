/**
 * Pastilla de estado de la última columna de la tabla de módulos.
 *
 * Vive en `citas/` porque `module-page.tsx` es el único que la usa; antes
 * estaba en `compartidos/ui.tsx`, mezclada con botones que sí comparten
 * varios módulos.
 */
export function Status({ text }: { text: string }) { const tone = ['Confirmada', 'Activo', 'Disponible', 'Completada', 'Listo'].includes(text) ? 'bg-blue-50 text-blue-700' : ['Pendiente', 'En espera', 'Limpieza', 'En proceso'].includes(text) ? 'bg-amber-50 text-amber-700' : ['Ocupada', 'En consulta'].includes(text) ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'; return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{text}</span> }
