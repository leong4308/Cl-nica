# Hospitalización

La interfaz utiliza /api/internacion y /api/internacion/[id]. Las rutas verifican la sesión y el rol real antes de consultar o escribir. Las escrituras llaman a clinica_hospital con la sesión autenticada.

Las migraciones 018 y 019 instalan permisos por paciente y operaciones transaccionales. Ingreso, reserva de cama y movimiento se confirman juntos o se revierten. El traslado conserva la clínica; un alta requiere confirmación y nota de egreso y libera la cama en la misma transacción. Las ediciones verifican actualizado_en y las correcciones de ingresos cerrados requieren justificación. Las restricciones únicas impiden dos ingresos activos por cama o paciente. Administración puede reconciliar la ocupación mediante la misma función transaccional.

Los médicos consultan pacientes autorizados; el mapa no revela identidades de pacientes ajenos ni marca como inconsistencias las camas cuya historia no pueden consultar.

Instalación y respaldo: consulta el README raíz. Validación: pnpm test:unit, pnpm test:sql, pnpm typecheck, pnpm build y pnpm test:e2e. La suite SQL usa PostgreSQL aislado; las comprobaciones con Supabase no deben alterar historias reales.
