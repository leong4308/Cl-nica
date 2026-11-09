# Hospitalización

La interfaz consume `/api/internacion` y `/api/internacion/[id]`. Las rutas verifican la sesión y el rol real (administrador, médico o enfermería) antes de consultar o escribir. Las escrituras usan el cliente de servicio exclusivamente en el servidor.

- Un ingreso vincula paciente activo, médico y cama de la misma clínica. La cama se reserva con una actualización condicional y se comprueba que no tenga otro ingreso activo.
- Editar requiere la versión leída (`actualizado_en`). El paciente y las fechas históricas se conservan. Un traslado interno mantiene el ingreso activo y libera la cama anterior después del cambio.
- Un alta requiere nota de egreso y confirmación; queda registrada en episodios junto con la identidad del usuario autenticado. Los ingresos cerrados admiten correcciones justificadas sin reasignar ni ocupar camas.
- Si una escritura falla, se compensan el movimiento y la reserva. Los fallos de compensación se comunican para revisión. El mapa señala diferencias entre la ocupación y los ingresos activos; solo administración puede reconciliarlas.

Las operaciones se serializan dentro del proceso de Next.js; la reserva condicional también protege una cama frente a peticiones simultáneas. Esta cola no es una transacción distribuida. Antes de desplegar varias instancias, mover el conjunto ingreso/traslado/alta a transacciones de PostgreSQL y añadir restricciones de unicidad para pacientes y camas con ingreso activo.

Validación: `npm run test:unit`, `npm run typecheck`, `npm run build` y `npx playwright test tests/e2e/internacion.spec.ts`. La suite completa `npm run test:e2e` también contiene pruebas antiguas del panel que requieren su cuenta y datos de agenda específicos (`E2E_USUARIO` / `E2E_CLAVE`). Las pruebas de navegador de `tests/e2e/internacion.spec.ts` usan datos simulados. Las verificaciones con Supabase deben crear y eliminar sus propios pacientes y camas temporales, sin alterar historias reales.
