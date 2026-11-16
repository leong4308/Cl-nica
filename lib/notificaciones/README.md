# Notificaciones y Telegram

La migración `020_notificaciones.sql` crea la bandeja privada, las vinculaciones y la cola de envíos; `021_telegram_desvinculacion.sql` permite reutilizar un chat después de desvincularlo. `024_respuestas_citas.sql` añade las respuestas de asistencia, solicitudes de cambio y el recordatorio de 30 minutos. `025_telegram_https.sql` habilita al trabajador para usar HTTPS sin abrir una conexión PostgreSQL. `026_reagenda_turnos.sql` añade turnos seleccionables y el límite de dos horas. `pnpm db:actualizar` instala las migraciones y registra sus hashes. No se crean avisos ficticios ni se notifican citas antiguas al instalar.

Si ya estaban instaladas las migraciones hasta 023 y ejecutaste 024/025/026 desde SQL Editor, el instalador reconocerá sus funciones y tablas con RLS antes de registrar los hashes locales, sin repetir su creación. Si no coinciden, no las marca como aplicadas. El número de versión por sí solo no basta.

La campana funciona para todos los roles. Citas nuevas, cambios de horario, reasignaciones y estados avisan al paciente, al médico y a administración/recepción. Hospitalización, órdenes y laboratorio avisan al paciente, al médico responsable y a administración/enfermería. Cada cuenta solo puede leer y marcar sus propios avisos; el navegador no puede crearlos ni acceder a los chats de Telegram.

La bandeja usa Supabase Realtime y una consulta de respaldo cada 15 segundos. Los avisos se conservan al recargar. El contador incluye todos los no leídos y se muestran los últimos 50. Marcar todo respeta el último aviso visto para no ocultar uno que acaba de llegar. El botón **Activar sonido** habilita un tono breve y permite silenciarlo; la preferencia se guarda por cuenta en ese navegador. Los avisos históricos de la primera carga no suenan. Después de recargar, el navegador puede exigir una interacción antes de volver a permitir audio.

## Configurar Telegram

1. En Telegram abre **@BotFather**, usa `/mybots`, elige el bot y copia su **API Token**.
2. Guarda en `.env.local` `TELEGRAM_BOT_TOKEN` y `TELEGRAM_BOT_USERNAME` (el usuario público del bot, sin `@`). El token nunca usa el prefijo `NEXT_PUBLIC_` ni se envía al navegador.
3. Desde la carpeta `Cl-nica`, ejecuta `pnpm notificaciones:escuchar` o `node scripts/notificaciones.mjs`. Mantén ese proceso activo durante las pruebas. Usa `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` por HTTPS; no necesita `SUPABASE_DB_URL`, una dirección pública ni webhook. La clave de servicio nunca se envía al navegador.
4. Cada usuario abre **Campana → Vincular Telegram → Abrir Telegram y pulsar Iniciar**. Regresa al portal y pulsa **Confirmar mi Telegram**, verificando el nombre mostrado. El enlace vence en diez minutos y solo se guarda su hash. Abrir un enlace no activa mensajes clínicos hasta confirmar en la sesión autenticada. Un chat privado solo puede estar vinculado a una cuenta.
5. Para dejar de recibir mensajes, pulsa **Desvincular Telegram** o envía `/stop` al bot.

Telegram Bot API necesita un `chat_id` y que el usuario haya iniciado el bot. El número de teléfono del paciente no basta para enviarle un mensaje. No se pide cambiar ni publicar su teléfono para vincularse. Referencias: [enlaces de bots](https://core.telegram.org/bots/features#deep-linking), [sendMessage](https://core.telegram.org/bots/api#sendmessage).

Los mensajes incluyen paciente, médico, fecha, horario, clínica y estado de la cita; no incluyen diagnósticos, recetas, documentos ni motivos clínicos. Las otras actualizaciones invitan a abrir la cuenta para ver los detalles.

Las citas usan un formato sobrio y compacto: encabezado, fecha y hora en negrita, datos agrupados y estado en un bloque breve, mediante el HTML nativo de Telegram. El trabajador consulta los datos vigentes de la cita antes del envío, muestra la hora de Ciudad de México y conserva su estado real (una cita pendiente no se presenta como confirmada). Los textos se escapan antes de incluirlos en HTML para impedir etiquetas o enlaces introducidos desde nombres y direcciones.

## Recordatorios y ejecución continua

`pg_cron` ejecuta `clinica_generar_recordatorios()` cada cinco minutos cuando está disponible en Supabase. También lo ejecuta el trabajador. Genera recordatorios en las ventanas de 24 horas, 2 horas y 30 minutos previos, únicamente para citas pendientes/confirmadas y futuras. Cada ciclo genera solo la ventana más cercana: una cita creada faltando 20 minutos no recibe los tres avisos juntos. Son ventanas aproximadas, no una garantía de entrega al minuto exacto.

Los avisos se deduplican por usuario, cita, horario y ventana. Telegram solo envía a cuentas vinculadas. Omite avisos desactualizados, citas canceladas, horarios reemplazados y recordatorios vencidos. Cada envío tiene una reserva y hasta cinco intentos, con espera progresiva y respeto a `retry_after`. Un bloqueo del bot desactiva esa vinculación. Como Telegram no ofrece una clave de idempotencia para `sendMessage`, una respuesta perdida después de aceptar el mensaje puede producir un duplicado al reintentar; no se promete entrega exactamente una vez.

El proceso mantiene una reserva exclusiva de cinco minutos en Supabase, renovada por cada operación del trabajador. Al cerrar normalmente la libera; tras un cierre inesperado, otra instancia debe esperar a que venza. Las operaciones RPC son una lista cerrada con parámetros tipados, accesible solo con la clave de servicio; nunca ejecutan SQL recibido del cliente. Un bot que ya tenga webhook no se modifica automáticamente. Usa un bot dedicado a esta aplicación.

Para producción, ejecuta el trabajador como un servicio persistente del servidor. Alternativamente, `.github/workflows/notificaciones.yml` puede ejecutar un ciclo cada cinco minutos: configura los secretos `SUPABASE_SERVICE_ROLE_KEY` y `TELEGRAM_BOT_TOKEN`, las variables `NEXT_PUBLIC_SUPABASE_URL`, `TELEGRAM_BOT_USERNAME` y `HABILITAR_TELEGRAM=true`, y publica el workflow en la rama predeterminada. Los horarios de GitHub pueden retrasarse. No actives a la vez el servicio y el workflow; la reserva evita concurrencia, pero una segunda ejecución se informará como ocupada.

`pnpm notificaciones:procesar` ejecuta un único ciclo. La configuración local y los procesos de este equipo no configuran los secretos ni el servicio de un despliegue remoto. Si apagas el equipo y no hay trabajador remoto, los avisos del portal se siguen generando en Supabase, pero Telegram espera hasta que vuelva a arrancar el trabajador y omite los recordatorios vencidos.

## Confirmar, cancelar y elegir un horario libre

En **Mis citas → Ver detalles**, el paciente puede confirmar asistencia, cancelar tras una segunda confirmación o abrir **Ver horarios libres**. Al tocar un horario disponible se reprograma la misma cita y su asistencia queda confirmada. Se avisa al médico y recepción, y se audita la identidad del paciente y el canal de la operación.

**Se requiere una anticipación mayor a dos horas respecto a la cita actual.** Al llegar al límite exacto de dos horas se bloquea reagendar; confirmar asistencia y cancelar siguen permitidos. La regla se valida en PostgreSQL al guardar y protege también solicitudes antiguas, botones ya enviados y ediciones directas del personal. Cambiar la hora del navegador no evita el límite.

Los turnos proceden del horario publicado en configuracion_agenda. Respetan los días de atención, la duración de consulta, descansos, citas del médico y otras citas del paciente. Sin horario publicado no se inventan horas libres. El portal ofrece semanas futuras y Telegram muestra días de los próximos siete días con seis horas por página. Elegir otro día o usar Más horas actualiza las opciones.

El bot usa los mismos botones. Escribir **/citas** muestra las próximas cinco citas propias y permite abrir **Ver horarios libres** sin esperar otro recordatorio. Los botones de cada horario tienen tokens privados que vencen en diez minutos o al llegar al límite para reagendar. Se verifica el chat vinculado, la identidad, la versión de la cita y la disponibilidad al guardar. Si otro paciente ocupa el horario, la operación falla y la reserva anterior se conserva. Una segunda pulsación no crea otra cita.

Los botones de acción general vencen antes de la cita o a las 48 horas. Cambiar paciente, médico, clínica, fecha u hora los invalida; desvincular y volver a vincular Telegram también. Los grupos, otros remitentes y chats no vinculados no pueden actuar. Cancelar una cita exige tocar Cancelar cita y después Sí, cancelar cita. **/cancelar** solo abandona una conversación antigua de disponibilidad y no cancela una cita.

Las solicitudes de disponibilidad enviadas anteriormente se conservan en la bandeja de recepción. El personal puede responderlas o resolverlas, sujeto al mismo límite de reprogramación. Cuando el paciente elige un turno, su solicitud pendiente queda resuelta dentro de la misma transacción. La bandeja se actualiza por avisos, foco, cambios guardados y cada 30 segundos.

## Comprobaciones

### Correo e invitaciones (033)

`RESEND_API_KEY`, `EMAIL_FROM` y `APP_URL` habilitan el canal de correo. Las invitaciones de recepción/administración se envían directamente desde la ficha; la cuenta se crea al elegir contraseña desde el enlace privado y conserva el perfil existente. Las notificaciones de citas usan una cola independiente, limitada a pacientes con correo verificado y avisos habilitados. El mismo trabajador procesa ambos canales y permite funcionar solo con correo si no hay token de Telegram. Reinícialo después de actualizar.

Se comprueba de nuevo la cita y el consentimiento antes de cada intento. Los avisos de más de 23 horas se omiten; ese límite mantiene los reintentos dentro de la ventana de idempotencia de 24 horas de Resend. No se guardan cuerpos, destinatarios ni secretos en los registros del trabajador. Las tablas privadas conservan estado y códigos de error para administración técnica. El proveedor de prueba `resend.dev` solo envía a la cuenta titular; verifica un dominio antes de usar otros destinatarios.

`pnpm test:sql` prueba los destinatarios, RLS, deduplicación, ventanas de recordatorio, enlace de un solo uso, respuestas de asistencia, turnos publicados, cruces de médico y paciente, límite de dos horas, solicitudes, cancelación en dos pasos, invalidación de botones, reintentos y `/stop` con PostgreSQL aislado y Telegram simulado. `tests/telegram.test.mjs` verifica mensajes y errores sin contactar Telegram. Las pruebas de navegador comprueban campana, vinculación, respuesta del paciente y bandeja de recepción. La prueba final con un teléfono real requiere que el titular inicie y confirme su vinculación y que el trabajador permanezca activo.

## Agendar una cita nueva (027)

Instala 027_autogestion_y_sesiones.sql y reinicia el trabajador. **/agendar** identifica al paciente por el chat vinculado, ofrece médicos con horario publicado y muestra los próximos siete días con horas por páginas. Seleccionar una hora abre el resumen; solo **Confirmar y agendar** crea la cita. En la aplicación se pueden explorar semanas adicionales. La reserva comprueba ocupación, descansos y duración en una transacción y avisa a las cuentas correspondientes. Cada solicitud tiene una clave única para evitar duplicados al pulsar otra vez. Los enlaces de reserva vencen en 30 minutos y sus horarios en 10; cambiar el vínculo de Telegram invalida los anteriores. Mantén el trabajador en ejecución para recibir los botones y las respuestas.
