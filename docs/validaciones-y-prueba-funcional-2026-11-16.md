# Validaciones y prueba funcional — 16 de noviembre de 2026

La aplicación compila con Next.js 16.3.3 (versión del proyecto 0.1.0). Supabase tiene instalada la migración **044_validacion_contactos.sql**. El instalador comprobó los hashes de las migraciones anteriores. Se creó y verificó un respaldo cifrado antes de aplicar la actualización.

## Restricciones implementadas

- Teléfonos personales y de emergencia: solo dígitos ASCII, exactamente 10 para guardar; teclado numérico en móvil. Los campos opcionales admiten vacío y el registro público sigue exigiéndolos.
- Al pegar un teléfono local con espacios, paréntesis o guiones se conservan sus dígitos. Los pegados con letras, prefijo de país o más de 10 dígitos se rechazan sin recortarlos. Los ceros iniciales se conservan.
- Nombres personales y de contactos: entre 3 y 200 caracteres, con letras, acentos, espacios, apóstrofos, puntos y guiones; sin números, saltos de línea ni otros símbolos.
- Nacimiento: fecha existente entre el 1 de enero de 1900 y hoy, usando la fecha de Ciudad de México.
- Correo: formato válido y hasta 150 caracteres. El cambio de un correo de acceso conserva la confirmación de propiedad existente.
- Contacto de emergencia: nombre y teléfono juntos, o ambos vacíos cuando son opcionales.
- Notas iniciales del paciente: hasta 8,000 caracteres. El texto clínico permite números.

Se aplican en registro público, pacientes, perfil y contactos de enfermería, con validación en API y triggers de la base. No se cambiaron permisos ni las contraseñas existentes. El registro público conserva sus reglas de contraseña y confirmación de correo.

Se retiraron separadores de siete teléfonos existentes, conservando exactamente sus dígitos. Después de instalar: 10 teléfonos personales y un teléfono de emergencia cumplen la regla; ninguno requiere corrección. Los triggers comprueban los campos al crearse o cambiar: un dato histórico ajeno a una actualización no bloquea, por ejemplo, las preferencias de notificación.

## Verificación automática

| Comprobación | Resultado |
|---|---|
| Compilación de producción y TypeScript | Correcta |
| Pruebas unitarias y de API | 167 aprobadas |
| SQL en bases PGlite aisladas | 121 aprobadas |
| Escenarios de Chrome sobre producción | 124 aprobados, completados en dos ejecuciones |
| Consultas de integración en Supabase real | 9 aprobadas, solo lectura |

El flujo SQL integrado conecta administración, recepción, enfermería, médico y paciente: publicación de recursos, registro e invitación, cita y confirmación, llegada, atención y signos, consulta, orden, muestra, resultado y seguimiento. Las pruebas de navegador cubren también edición, PDF y Excel, adjuntos, sesión, notificaciones, portal, espera y navegación móvil. Las restricciones nuevas prueban escritura, pegado, longitud, ceros iniciales, nombres inválidos y fechas futuras.

La primera ejecución de navegador completó 118 escenarios anteriores; tras ajustar cómo la prueba corrige un pegado inválido, pasaron los seis escenarios del registro. Se corrigió también una fecha de la prueba SQL médica que podía cruzar medianoche: la prueba ahora agenda el siguiente día a una hora fija; la regla clínica no se debilitó.

La antigua prueba de Supabase exigía seis médicos con nombres y horarios fijos y consultaba una tabla de agendas antigua. Ahora verifica la configuración publicada real, referencias, duración, cruces de médico y paciente, contactos, relaciones y falta de acceso anónimo, sin imponer una semilla ni escribir datos.

## Comprobación con las cuentas reales de prueba

Se inició una sesión nueva por rol contra Supabase y se consultó temporalmente la compilación local del puerto 3212. Cada sesión de prueba se cerró con alcance `local`, sin cerrar sesiones de otros dispositivos.

| Rol | Sesión, perfil y panel propios | Acceso a módulo ajeno |
|---|---|---|
| Administrador | HTTP 200, rol correcto | No corresponde al administrador general |
| Médico | HTTP 200, rol correcto | Administración de usuarios: HTTP 403 |
| Recepcionista | HTTP 200, rol correcto | Enfermería: HTTP 403 |
| Enfermero | HTTP 200, rol correcto | Panel médico: HTTP 403 |
| Paciente | HTTP 200, únicamente ficha propia | Directorio de pacientes: HTTP 403 |

## Telegram y correo reales

- Se añadió un aviso identificado como **Prueba funcional de avisos** a la cuenta de paciente cuyo Telegram ya estaba vinculado. El trabajador existente lo procesó y guardó el estado `enviado`. El mismo aviso apareció en su campana al consultar la aplicación con su sesión real.
- Se envió un correo de prueba al correo autorizado del titular de Resend, con la función y plantilla de envío de la aplicación. Resend confirmó el evento **`delivered`**.
- No se crearon ni modificaron citas reales para estas pruebas. La generación de recordatorios por hora, su vigencia y las respuestas a citas se verifican en las pruebas aisladas; el envío de correo de esta comprobación usa directamente el canal, no una cita ficticia insertada en la cola clínica.
- Telegram confirma aceptación del mensaje por el servicio; esta prueba no acredita que una persona lo haya leído.

## Pendientes para acceso público

1. **Correo a todos los pacientes:** Resend mantiene el remitente de prueba y cero dominios verificados. Hay ocho envíos históricos fallidos con `HTTP_403`. La entrega al correo de prueba del titular funciona, pero eso no habilita correos a los demás pacientes. Hace falta verificar un dominio y configurar su remitente.
2. **Enlaces externos:** `APP_URL` todavía no utiliza una dirección pública HTTPS. Los enlaces de avisos e invitaciones necesitan la URL pública del túnel o despliegue y su configuración de redirecciones en Supabase.
3. **Disponibilidad del trabajador:** se comprobó activo y se dejó funcionando. Los avisos dependen de mantenerlo y la aplicación en ejecución.

Estos resultados comprueban los escenarios descritos; no equivalen a certificar el sistema al 100 % para cualquier carga, dispositivo o situación futura. Las evidencias operativas privadas y los respaldos se mantienen fuera de Git; no se incorporan claves, tokens, chats ni datos clínicos al informe.
