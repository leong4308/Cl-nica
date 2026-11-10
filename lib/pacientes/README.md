# Directorio de pacientes por médico

El listado y el buscador de pacientes usan `GET /api/pacientes`. El servidor verifica la sesión y el rol en `usuarios`; no acepta un identificador de médico enviado por el navegador.

Para médicos, el vínculo se obtiene de sus citas pendientes, confirmadas o atendidas y de las internaciones en las que figura como responsable, incluyendo las altas para conservar el seguimiento. Se agrupan los pacientes sin duplicados. Una cita cancelada o una inasistencia por sí sola no establece el vínculo. Un paciente atendido por varios médicos aparece en sus respectivas listas.

Administración, recepción y enfermería conservan el directorio general. Un médico sin perfil activo o sin pacientes vinculados obtiene una lista vacía. Un fallo de consulta devuelve un error, sin usar el directorio general como alternativa. Los pacientes recién registrados sin citas ni internaciones permanecen en el directorio general hasta que exista esa relación.

Este cambio filtra el directorio de la aplicación; no sustituye las políticas RLS de Supabase de los demás módulos.
