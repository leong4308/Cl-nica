# Enfermería

Requiere `supabase/migraciones/028_enfermeria.sql`, después de la versión 027, y `029_controles_enfermeria.sql` para validar el parámetro del control y la hora observada. El archivo se ejecuta completo una vez desde SQL Editor si la conexión PostgreSQL local no está disponible. No borra historias ni crea asignaciones clínicas ficticias.

## Uso

- **Administración → Enfermería → Asignar turno:** seleccionar paciente, enfermero, área y fechas/horas. Cada asignación dura hasta 24 horas. Se pueden asignar varios pacientes al mismo enfermero y preparar el siguiente relevo. Retirar una asignación exige motivo y conserva el historial.
- **Médico → Enfermería:** revisar pacientes vinculados, programar controles y cuidados y responder incidencias. Para programar un medicamento, elegir una orden activa y escribir expresamente la dosis, vía y hora autorizadas. No se interpretan automáticamente instrucciones de texto libre. Los límites de alerta de un control son opcionales y solo los introduce el médico.
- **Enfermero → Mi turno:** consultar sus pacientes, tomar signos, registrar notas, actualizar contacto y avisar al médico. Las mediciones conservan autor, hora observada y hora de registro. Las correcciones se añaden, sin editar el original; una medición corregida se excluye de la gráfica y deben registrarse los valores correctos como nueva medición.
- **Medicamentos:** verificar paciente e indicación, registrar administración o justificar omisión. La hora debe haber llegado. Cada dosis admite un único cumplimiento; si cambia la prescripción, el médico debe revisar y reprogramar. Una omisión genera incidencia y aviso al equipo médico. Se conserva la dosis y vía indicadas en el registro.
- **Órdenes médicas:** lectura de instrucciones y documentos. Enfermería puede registrar inicio/cumplimiento de cuidados o procedimientos, sin editar la indicación. La administración de medicamentos se registra por dosis.
- **Laboratorio:** toma y entrega de muestras con autor y hora; consulta de resultados completados y PDF disponible. No puede modificar ni validar resultados ni reemplazar documentos de la prescripción.
- **Internación:** el médico autoriza alta o traslado desde Enfermería; el enfermero confirma la ejecución y escribe la nota correspondiente. La autorización queda ligada a la versión del ingreso y no puede reutilizarse. Si el ingreso cambia, se requiere una nueva autorización. La cama y el movimiento se guardan en la misma transacción.
- **Citas:** consulta y registro de llegada de las citas del día. No cambia el estado clínico a atendida ni permite agendar o cancelar.
- **Entrega de turno:** seleccionar el relevo que tenga asignado al paciente y dejar situación, cuidados y pendientes. El destinatario confirma recepción cuando comienza su acceso al paciente. Las incidencias pueden recibir respuesta del médico.

## Protección de datos

`clinica_paciente` valida la asignación vigente con la hora del servidor. RLS protege también las consultas REST directas. Las escrituras se realizan mediante una lista cerrada de operaciones que deriva la identidad de Auth; la sesión debe estar activa. Las entradas anteriores de hospitalización, edición general y registro de pacientes ya no permiten a enfermería eludir estas reglas.

Los registros no admiten cambios o borrados desde el navegador. Se auditan notas, turnos, tareas, autorizaciones y acuses. Las claves de solicitud y la unicidad de una dosis impiden duplicados por reintentos. Las notificaciones de incidencias y entregas no incluyen el contenido clínico en Telegram; se consulta desde la cuenta autorizada.

Las pruebas SQL ejecutan estas operaciones en PostgreSQL aislado; las pruebas de navegador simulan la API y no generan dosis, notas ni citas reales.
