# Clínica Nova

Next.js, Supabase Auth, PostgreSQL y almacenamiento privado de documentos clínicos.

## Desarrollo y comprobaciones

```text
pnpm install --frozen-lockfile
pnpm dev --port 3001
pnpm test:unit
pnpm test:sql
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Las pruebas normales usan datos simulados o una base PostgreSQL aislada en memoria, sin tocar historias reales. Las pruebas antiguas de `panel.spec.ts` se ejecutan únicamente con `E2E_INTEGRACION_REAL=true`, `E2E_USUARIO` y `E2E_CLAVE`, en un entorno de prueba con sus datos específicos. En Windows puede usarse `PLAYWRIGHT_CHANNEL=chrome` si Chrome está instalado y no se descargó Chromium.

## Instalar la actualización de seguridad

1. Conserva un respaldo del proyecto antes de actualizar su base.
2. Configura `SUPABASE_DB_URL` en `.env.local` con la URI de **Supabase → Connect** y la contraseña de la base. No es la clave de servicio. Los caracteres especiales de la contraseña deben codificarse en la URI. Nunca subas ese archivo a Git.
3. Ejecuta `pnpm db:actualizar`. Aplica las migraciones de `018_seguridad_y_auditoria.sql` a `029_controles_enfermeria.sql`, comprueba sus hashes y registra las versiones. Si existen citas solapadas o ingresos activos duplicados, se detiene sin eliminarlos. Resuelve los conflictos antes de volver a ejecutar.
4. Ejecuta `pnpm agenda:importar` para copiar las agendas privadas anteriores a PostgreSQL sin sobrescribir las ya publicadas. No se inventan horarios.
5. También se pueden ejecutar esos archivos SQL, en orden numérico, desde el editor de Supabase. La importación de agendas sigue siendo necesaria si había horarios guardados en Storage.
6. Inicia sesión como administrador y abre **Configuración → Verificar estado**. Comprueba los distintos roles antes de publicar.

Si la conexión informa `SELF_SIGNED_CERT_IN_CHAIN`, configura `SUPABASE_DB_CA_FILE=certificados/supabase-ca-2021.crt`. El certificado público incluido corresponde al [enlace oficial del panel de Supabase](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json); la conexión conserva la verificación del certificado y del servidor.

Las operaciones que necesitan estas funciones devuelven un aviso de configuración si aún no se instalaron; no simulan guardados ni recurren a escrituras parciales.

## Permisos, asignación y auditoría

- Las políticas RLS protegen directamente la base: un médico solo accede a pacientes vinculados. Las rutas que firman documentos verifican también la relación antes de usar el almacenamiento de servicio.
- Administración gestiona el equipo desde **Pacientes → Ver perfil → Administrar médicos**. Puede elegir un principal y colaboradores, justificar cambios y retirar accesos. Las transferencias detectan ediciones concurrentes y exigen resolver citas futuras o una internación activa antes de retirar al responsable.
- Un paciente registrado por un médico queda vinculado a este en la misma transacción. Recepción puede registrar pacientes generales y agendar con cualquier médico activo.
- **Historial de cambios**, en el menú administrativo, muestra fecha, autor, registro y valores anteriores/nuevos. El cliente no puede modificar la bitácora. Las escrituras con la clave de servicio solo se realizan después de verificar el rol y transmiten la identidad verificada al registro de auditoría cuando corresponde.
- Citas, descansos e internaciones usan transacciones, bloqueos y restricciones de PostgreSQL. Un fallo revierte el conjunto de cambios. La cola local ya no es la garantía de concurrencia.
- Los PDF reemplazados permanecen privados para conservar versiones y permitir respaldos consistentes. La aplicación solo entrega el documento actual autorizado. Cualquier política de purga deberá respetar los respaldos y la conservación acordada por la clínica.

## Portal del paciente

El paciente utiliza un portal propio: Mi inicio, Mis citas, Mis resultados, Mis consultas y Mis datos. No se monta ni se precarga el resumen del personal. `/api/portal-paciente` obtiene su identidad desde la sesión y no acepta un ID de paciente del navegador. La migración 022 impide consultar catálogos operativos con ese rol. Los PDF se abren en modo lectura después de comprobar la propiedad; los resultados en preparación no publican texto ni archivos. La ayuda del paciente contiene instrucciones de su portal.

La migración 023 impide también consultar resultados en borrador mediante SQL o REST directo con una sesión de paciente.

La migración 024 permite confirmar asistencia, cancelar con confirmación y solicitar otro horario desde el portal y Telegram. Recepción recibe los días y horas disponibles del paciente en su bandeja de solicitudes; la cita actual se conserva hasta acordar y registrar el cambio. Los recordatorios se generan a las 24 horas, 2 horas y 30 minutos previos. Para vincular el bot y mantener el trabajador activo, consulta [Notificaciones y Telegram](lib/notificaciones/README.md).

La migración 025 permite ejecutar el trabajador por HTTPS usando la clave de servicio del servidor. El bot no depende de la conexión PostgreSQL de `SUPABASE_DB_URL`; esa conexión sigue usándose para migraciones y respaldos. Una reserva exclusiva impide que dos instancias procesen el mismo bot.

La migración 026 añade horarios libres para seleccionar desde el portal y Telegram. Elegir un turno reprograma la misma cita y confirma asistencia, con aviso al médico y recepción. Solo se ofrecen bloques publicados, sin descansos ni cruces de médico o paciente. Si faltan dos horas o menos para la cita actual, el servidor bloquea la reprogramación, incluidas solicitudes antiguas y ediciones del personal; confirmar y cancelar siguen disponibles. La agenda semanal se administra desde Médicos → Configurar horario.

## Recuperación de contraseña

Desde el login se solicita un enlace por correo. El callback valida el intercambio de código y establece una autorización temporal, de diez minutos, para elegir la contraseña. Se rechazan destinos externos y se cierran las sesiones después del cambio.

Configura en **Supabase Auth → URL Configuration** la dirección real de la aplicación y el callback de recuperación. En desarrollo incluye `http://localhost:3001/auth/callback?next=/restablecer-contrasena`; en producción utiliza el dominio HTTPS real. Configura y comprueba la entrega de correo del proyecto. El código de la aplicación no puede instalar estas opciones del proveedor usando la clave de servicio. No se revela si un correo tiene una cuenta.

Referencia: [recuperación de contraseñas de Supabase](https://supabase.com/docs/guides/auth/passwords).

## Respaldos cifrados y restauración de prueba

Requiere las herramientas `pg_dump` y `pg_restore`, de una versión compatible con el servidor. Si no están en PATH, configura `PG_DUMP_BIN` y `PG_RESTORE_BIN`. La conexión usa las variables PG del proceso, sin incluir la contraseña en argumentos ni imprimirla.

```text
pnpm respaldo:clave
pnpm respaldo:crear
pnpm respaldo:verificar respaldos/ARCHIVO.cnbak
```

La clave local se conserva en `.backup.key`, excluida de Git; en CI se usa `BACKUP_ENCRYPTION_KEY`. Guarda una copia de esa clave fuera del equipo. Sin ella no se pueden descifrar los respaldos. Los archivos `.cnbak` incluyen el volcado de `public`, `auth` y `storage`, los archivos de los buckets, un manifiesto y comprobaciones de integridad. Los datos se cifran con AES-256-GCM antes de escribirse en disco. Un respaldo fallido no se publica como completo.

Para probar la restauración, configura `RESTORE_DB_URL`, `RESTORE_SUPABASE_URL` y `RESTORE_SERVICE_ROLE_KEY` de un **proyecto de prueba vacío, diferente del original**. Ejecuta:

```text
pnpm respaldo:restaurar respaldos/ARCHIVO.cnbak
```

El script autentica y verifica todo el respaldo antes de modificar el destino. Rechaza destinos con tablas públicas, usuarios o documentos, y el proyecto original. PostgreSQL se restaura en una transacción; después se suben los archivos al destino. Si falla la subida, la restauración se informa como incompleta; usa un nuevo destino vacío para repetir la prueba. Comprueba login, recuentos, relaciones, RLS y apertura de documentos. La prueba de restauración real requiere esas conexiones; las pruebas locales de cifrado no la sustituyen.

Los scripts no copian secretos de configuración del proveedor ni recrean proyectos, SMTP, dominios o funciones externas de Supabase. Esos ajustes deben conservarse por separado. Referencia: [respaldos de Supabase](https://supabase.com/docs/guides/platform/backups).

## Automatización y diagnóstico

`.github/workflows/verificar.yml` ejecuta pruebas unitarias, SQL, TypeScript, compilación y navegador en cada push/PR. No utiliza secretos ni datos clínicos.

`.github/workflows/respaldar.yml` realiza un respaldo diario a las 10:00 UTC (04:00 de Ciudad de México), con conservación de artefactos cifrados por 30 días. Para activarlo en GitHub configura los secretos `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_ENCRYPTION_KEY` y la variable `HABILITAR_RESPALDOS=true`. Debe estar publicado en la rama predeterminada. La clave de cifrado no se incluye en el artefacto. Ajusta la frecuencia y conservación a las necesidades reales de la clínica.

El servidor registra errores estructurados sin cuerpos, tokens, cookies ni texto clínico. El administrador puede comprobar la versión instalada mediante **Configuración → Verificar estado**. Los registros de errores deben conservarse en la plataforma donde se despliegue la aplicación.

## Reservas propias, sesiones y reportes (027)

Instala **027_autogestion_y_sesiones.sql** después de 026. En Supabase SQL Editor se ejecuta el archivo completo una sola vez; el instalador también reconoce su contenido si se aplicó manualmente.

El paciente puede abrir **Agendar mi cita** desde Mi inicio cuando no tiene citas próximas, o desde Mis citas. Elige médico, semana y horario, revisa el resumen y confirma. Nombre, correo y teléfono proceden de su cuenta: no se acepta un paciente indicado por el navegador. Solo se muestran jornadas publicadas; se verifican descansos, duración y cruces otra vez al confirmar. La transacción genera avisos al paciente, médico y recepción. Los reintentos de la misma solicitud no duplican la cita. En Telegram, **/agendar** ofrece el mismo flujo a la cuenta vinculada y pide una confirmación adicional antes de reservar.

El JWT conserva la renovación automática de Supabase y muestra un aviso al renovarse o acercarse su vencimiento, con opción **Renovar sesión**. La aplicación permanece abierta. Después de **15 minutos sin interacción**, se oculta el contenido y se pide la contraseña de la misma cuenta para continuar. No se desmontan los formularios abiertos. El estado se registra por session_id verificado contra auth.sessions y se protege con RLS: las consultas periódicas y la renovación del mismo JWT no desbloquean una sesión inactiva. Para desbloquear, Auth verifica la contraseña y emite una nueva sesión. El estado se sincroniza entre pestañas. Si Auth revoca el acceso, se conserva la pantalla con el bloqueo hasta verificarlo; cerrar sesión explícitamente sí sale y elimina el estado de la aplicación.

Los reportes PDF de citas, pacientes, expedientes e internación comparten encabezado, fecha de emisión de Ciudad de México, resumen, filas alternadas y estados destacados. El botón abre la vista para **Guardar como PDF / Imprimir** del navegador, sin depender de un CDN. Los reportes Excel de expedientes e internación se generan como **.xlsx** mediante ExcelJS, con encabezados, filtros, panel inmovilizado y formato de impresión; respetan las filas filtradas y conservan los textos como texto.

## Enfermería y continuidad de cuidados (028)

El rol de enfermería usa Mi turno, pacientes asignados, notas y signos con historial y gráficas, administración de dosis programadas, seguimiento de muestras y entrega de turno con recepción confirmada. Administración asigna al paciente y el horario desde el nuevo módulo Enfermería; el médico programa indicaciones, responde incidencias y autoriza altas o traslados. Los permisos se aplican en la base y en las API. No se crean asignaciones ni mediciones ficticias. Consulta el [flujo completo y sus permisos](lib/enfermeria/README.md).


## Recepción y sala de espera

Instala `030_recepcion.sql` con `npm run db:actualizar` después de crear un respaldo. Recepción dispone de Inicio (Resumen), Citas, Sala de espera, Pacientes, Solicitudes y Médicos. Las métricas y horarios corresponden a la fecha seleccionada, en hora de Ciudad de México.

Registrar llegada conserva la cita pendiente/confirmada y avisa al médico y a enfermería asignada. Solo el médico de la cita inicia la atención; al finalizar desde su flujo clínico, recepción ve «Finalizada». La espera se calcula desde la llegada hasta el inicio de consulta. No se puede iniciar otra consulta mientras haya una en curso para ese médico.

Recepción edita identificación y contacto, sin acceso directo a notas, antecedentes, signos, expedientes ni sus PDF. El directorio administrativo usa una RPC con campos explícitos; las restricciones también se aplican en RLS y en las API. Las cancelaciones e inasistencias requieren motivo; las inasistencias se registran después del horario si no hubo llegada. La reagenda requiere más de dos horas y una cita sin llegada registrada. Los cambios de recepción conservan actor, fecha, versión e identificador idempotente.

Las llegadas capturadas en enfermería alimentan la misma sala de espera. La instalación corrige una referencia ambigua de la RPC de enfermería sin modificar las migraciones anteriores. No se crean citas, llegadas ni mediciones de ejemplo en la base real.


## Atención del médico

`031_consulta_medica.sql` añade la agenda personal con sala de espera, consultas abiertas, resultados por revisar e incidencias de los pacientes vinculados. «Mi Consulta» conserva su acceso exclusivo de administración.

Desde Citas → Abrir consulta, el médico registra motivo/evolución, exploración, diagnóstico, plan, pronóstico, seguimiento y medicamentos (dosis, vía, frecuencia y duración). Puede guardar un borrador; para finalizar necesita iniciar la atención después de la llegada registrada. El guardado de la nota y el cambio de cita son una sola transacción, con control de versión e idempotencia. Las notas previas atendidas se conservan como cerradas y las correcciones son anexos con motivo y autor. Los borradores de otro médico no se comparten. Los documentos anteriores no se sustituyen.

Las órdenes ambulatorias se emiten desde la consulta sin requerir una internación. Sus estudios se muestran en Laboratorio y en el portal del paciente; solo se publican resultados completados y notas cerradas. El médico registra la revisión clínica de una versión concreta del resultado; si el informe cambia, vuelve a aparecer pendiente.

Consultar resultados no otorga permiso para validarlos. En Usuarios, administración puede activar «Autorizar validación de laboratorio» para un médico; la autorización se comprueba también en la API y mediante un trigger SQL. Hospitalización y el seguimiento de enfermería conservan su acceso clínico; los turnos de enfermería los asigna administración.

Para coordinar un cambio de cita, el médico usa la sección Coordinar cita y registra el motivo. Recepción recibe una solicitud identificada como originada por el médico, sin cambiar la reserva ni atribuir la solicitud al paciente. Se requiere más de dos horas de anticipación y no tener llegada registrada. No se permite mover el horario desde una actualización médica directa ni reabrir una cita finalizada.

La receta PDF se genera a partir de la nota cerrada e incluye los medicamentos y las aclaraciones posteriores. El registro de cierre identifica la cuenta actuante; no se presenta como un servicio de firma electrónica certificada.

## Administración de habitaciones y camas

`032_administracion_camas.sql` habilita el catálogo en **Internación → Administrar habitaciones y camas**, también accesible desde el resumen del administrador. Solo administración crea habitaciones por clínica, define su tipo y capacidad, registra camas y mantiene sus identificadores. Una cama libre puede deshabilitarse con motivo de mantenimiento, limpieza u otra causa operativa; se conserva su historial. Deshabilitar una habitación libre deja todas sus camas fuera de servicio. Al reabrirla se habilitan individualmente.

El catálogo no permite asignar ocupación manualmente ni eliminar ubicaciones históricas. Los ingresos, traslados y altas actualizan la ocupación. Las camas fuera de servicio no se ofrecen para ingreso y la base rechaza utilizarlas incluso desde una solicitud directa. No se renombra ni deshabilita una cama ocupada, ni se reduce la capacidad por debajo de sus camas habilitadas. Los cambios tienen auditoría, control de versión e idempotencia; los egresos conservan la ubicación registrada.

La autorización del alta clínica sigue correspondiendo al médico; administración gestiona recursos y enfermería ejecuta movimientos autorizados. El resumen distingue camas habilitadas y fuera de servicio. El directorio muestra médicos activos sin atribuirles disponibilidad de consulta. Registrar llegada mantiene la cita pendiente/confirmada y separa la sala de espera de la finalización clínica.

## Invitación al portal y correo de citas

Instala `033_portal_y_correo.sql` con `npm run db:actualizar` después de crear un respaldo. En **Pacientes → Ver detalle → Datos del paciente**, recepción y administración tienen el apartado **Acceso al portal del paciente**. Verifican el correo con el titular y pulsan **Invitar al portal**. Registrar la ficha sigue siendo posible sin correo ni cuenta de acceso.

El enlace de invitación vence en 24 horas; reenviarlo invalida el anterior y requiere esperar un minuto. Abrirlo muestra el nombre y correo vinculados, sin consumirlo. El paciente elige una contraseña de al menos 12 caracteres. La activación crea el acceso y enlaza el mismo usuario y perfil existentes dentro de la transacción de Auth; conserva citas, médicos e historial. Una cuenta ya vinculada usa recuperación de contraseña. No se unen fichas arbitrarias por correo ni se conceden roles de personal mediante metadatos públicos. El secreto se transmite en el fragmento del enlace, se retira de la dirección al abrirla y solo se guarda su hash en una tabla privada. No se devuelve al personal en la respuesta de la API.

Configura en `.env.local` `RESEND_API_KEY`, `EMAIL_FROM` y `APP_URL`. La URL debe ser la dirección accesible de la aplicación; localhost solo funciona en el equipo que la aloja. Resend permite `onboarding@resend.dev` únicamente para enviar al correo de la propia cuenta de Resend; los demás destinatarios requieren un dominio remitente verificado. No uses un dominio ajeno como remitente.

Los avisos de citas nuevas, cambios, estados y recordatorios de 24 horas, 2 horas y 30 minutos se encolan para el paciente con correo verificado, coincidente con Auth y avisos habilitados. No incluyen diagnósticos ni documentos. Desde **Notificaciones → Recordatorios por correo** el paciente puede desactivarlos. La aplicación y Telegram conservan sus propios avisos.

Reinicia `node scripts/notificaciones.mjs` para procesar también correo. `--una-vez` procesa un ciclo. Cada envío vuelve a comprobar identidad, preferencia y versión de cita, omite avisos antiguos o vencidos y utiliza una clave de idempotencia de Resend con hasta cinco intentos. «Aceptado por el servicio» no garantiza entrega en bandeja de entrada. Las invitaciones se envían al pulsar el botón y no dependen del trabajador. En un despliegue remoto configura las mismas variables y mantén el trabajador activo; el workflow acepta `HABILITAR_CORREO=true` y la clave como secreto de GitHub.

`034_correo_paciente.sql` permite capturar el correo opcional al registrar al paciente y editarlo desde **Editar información → Correo de acceso → Guardar cambios**, exclusivamente con administración o recepción. Si la ficha todavía no tiene cuenta, se guarda directamente y se invalidan invitaciones anteriores. Si tiene acceso activo, se envía al nuevo correo un enlace para confirmar el cambio; hasta confirmarlo se conserva el anterior. La contraseña no cambia. La confirmación utiliza la API administrativa de Auth y un trigger para actualizar la ficha en la misma transacción. Se comprueban duplicados, solicitudes vencidas y cambios concurrentes. Un fallo del proveedor conserva el correo actual y comunica si los demás datos personales ya se guardaron.


## Comunicaciones, lista de espera, consultorios, reportes y controles

Las migraciones `035_consultorios.sql`, `036_espera_y_controles.sql` y `037_comunicaciones_y_reportes.sql` se instalan con `npm run db:actualizar`, después de crear y verificar un respaldo. Reinicia el trabajador `node scripts/notificaciones.mjs` después de actualizarlas. No se generan consultorios, pacientes ni citas de demostración en la base real.

- **Comunicaciones** (administración y recepción): muestra hasta 200 avisos de los últimos 30 días, por canal y estado. Recepción consulta avisos operativos dirigidos a pacientes; no ve el contenido clínico. Permite hasta tres reintentos manuales de avisos pendientes o fallidos, dentro de 23 horas y con consentimiento y destinatario vigentes. No reenvía mensajes en curso ni aceptados por el proveedor. Telegram puede repetir un aviso si el proveedor lo aceptó pero se perdió el acuse. Las invitaciones siguen en la ficha del paciente.
- **Lista de espera** (administración, recepción y paciente): registra médico, rango de fechas y horas, y opcionalmente la cita que se desea adelantar. Al cancelar o mover una cita futura se ofrece el hueco por orden de inscripción, a otro paciente elegible con cuenta activa. Las ofertas duran hasta 20 minutos y requieren aceptación en el portal o Telegram. Rechazar o vencer una oferta permite pasar al siguiente paciente elegible; no se repite la misma oferta a la misma solicitud. No retienen cupo frente a otras reservas. Al aceptar, una transacción vuelve a comprobar agenda publicada, descansos, cruces, consultorio, propietario y versión. Para adelantar una cita deben faltar **más de dos horas**, sin llegada registrada. Ante un conflicto se conserva la reserva anterior.
- **Consultorios**: administración registra los espacios físicos reales por clínica y asigna un médico, día semanal, periodo y horario. Recepción solo consulta. Una sala o médico no puede tener asignaciones simultáneas. Las nuevas reservas de un médico con asignaciones se limitan a sus turnos de consultorio; un médico que todavía no tiene asignaciones conserva su agenda publicada. Las asignaciones vencidas deben renovarse. Registrar un turno ubica las citas futuras que coincidan; las demás citas previas se conservan pendientes de ubicación. No se desactiva un turno con citas vigentes. La cita guarda la ubicación histórica; los consultorios son independientes de las habitaciones y camas de internación.
- **Reportes** (administración): periodo de hasta 366 días y filtro por médico, incluyendo médicos inactivos con historial. Presenta programadas, atendidas, canceladas, inasistencias y pendientes, con gráfica diaria e informe PDF/Excel. Los promedios muestran el número de mediciones: espera desde llegada hasta inicio, y consulta desde inicio hasta cierre de la nota. Sin marcas reales se indica «Sin registros».
- **Controles**: el médico indica fecha, instrucciones y anticipación del aviso para un paciente de su atención, también desde una nota cerrada. El paciente consulta **Mis controles**, reserva explícitamente con ese médico y asocia la cita creada o una reserva futura propia. Indicar o recordar un control nunca crea una cita. Al atender su cita asociada el control queda completado; cancelarla o registrar inasistencia devuelve el control a pendiente. El médico también puede registrar el resultado o cancelar el control con motivo, sin cancelar sus citas. Se envía un aviso al indicarlo, otro desde la fecha de aviso y uno si sigue pendiente siete días después; cada aviso se deduplica y respeta los canales habilitados.

Los módulos verifican permisos y sesión en API y PostgreSQL. Los registros clínicos y tablas de gestión nuevas no tienen acceso directo desde el navegador; las escrituras cuentan con control de versión, idempotencia y auditoría. Las pruebas nuevas están en `tests/gestion-operativa.test.mjs`, `tests/gestion-operativa-sql.test.mjs` y `tests/e2e/gestion-operativa.spec.ts`.


## Datos personales del paciente

`038_datos_personales_paciente.sql` y `039_conflicto_perfil.sql` habilitan **Mis datos → Editar mis datos**, también desde **Mi perfil**. El paciente actualiza su nombre, teléfono, fecha de nacimiento, género y contacto de emergencia. Los campos opcionales pueden quedar vacíos. El correo de acceso conserva el cambio verificado a través de recepción; no se modifican roles, médicos, diagnósticos, recetas ni resultados desde este formulario.

La API valida los campos y la función SQL obtiene la ficha desde la sesión activa, sin recibir un identificador de paciente. Guarda nombre/contactos en una transacción con auditoría y una versión de los datos personales. Una edición concurrente conserva el formulario y pide cargar los datos actuales antes de reemplazarlos. Las sesiones bloqueadas o fichas inactivas no guardan datos. Tras guardar, Mis datos y el encabezado se actualizan sin cerrar la sesión.
