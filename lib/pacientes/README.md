# Pacientes y médicos tratantes

El listado y el buscador usan GET /api/pacientes. La cuenta y el rol se verifican en el servidor; no se acepta un médico elegido por el navegador para ampliar el acceso.

Después de instalar las migraciones 018 y 019, las políticas RLS protegen el acceso directo a pacientes, citas, expedientes, órdenes, laboratorio y usuarios relacionados. Las rutas que generan enlaces de documentos verifican adicionalmente el paciente antes de usar el almacenamiento de servicio.

La relación inicial se obtiene de citas pendientes, confirmadas o atendidas y de internaciones como responsable. Administración puede elegir un médico principal y colaboradores desde el perfil del paciente, justificar transferencias y revocar accesos. Una revocación explícita prevalece sobre la historia anterior. Se exige resolver citas futuras e internaciones activas antes de retirar al médico responsable. Cada cambio verifica una versión y se registra en auditoría.

El registro de un paciente por un médico crea su vínculo en la misma transacción. Los registros de recepción sin médico quedan en el directorio general. Un paciente compartido aparece en las listas de sus médicos. Un perfil médico inexistente o sin pacientes produce una lista vacía, no el directorio completo.

Instalación: README raíz. Antes de aplicar las migraciones, el listado puede derivar relaciones históricas; eso no sustituye la actualización de permisos en Supabase.
