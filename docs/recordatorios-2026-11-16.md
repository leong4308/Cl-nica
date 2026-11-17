# Diagnóstico y recuperación de recordatorios · 16 de noviembre de 2026

Se comprobó Supabase 42, las colas de Telegram/correo, la vinculación del bot y la configuración de Resend mediante consultas y API de lectura.

- El trabajo programado `clinica-recordatorios` estaba activo cada cinco minutos y generaba los recordatorios. La reserva del trabajador había vencido; no había ningún proceso local de notificaciones activo.
- El bot respondió correctamente, su nombre coincidía con la configuración y no tenía un webhook incompatible. Había una cuenta de paciente vinculada. Las demás cuentas necesitan completar su propia vinculación para recibir sus avisos por Telegram.
- Había cuatro envíos de Telegram y seis de correo pendientes. Tras la autorización explícita del usuario, se dejó activo el trabajador local. Telegram aceptó los cuatro avisos y su cola quedó sin pendientes.
- Resend no tenía dominios verificados y `EMAIL_FROM` utilizaba el remitente de prueba. Los seis avisos dirigidos a otros destinatarios fueron rechazados con `HTTP_403`.
- El usuario eligió pruebas con su correo titular de Resend. Se envió un único aviso de prueba, sin representar una cita registrada ni modificar las cuentas de pacientes. La consulta posterior a Resend confirmó `last_event: delivered`.

El remitente de prueba solo permite ese destinatario. Para comprobar recordatorios automáticos reales por correo, la cuenta de paciente debe utilizar ese mismo correo y tenerlo confirmado. Los avisos destinados a otros correos requieren un dominio propio verificado; no se redirigen al correo de pruebas. Los envíos fallidos pueden revisarse desde Comunicaciones, y solo deben reintentarse después de resolver su causa y mientras sigan vigentes. Referencia: [restricción oficial de Resend](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Se modificó `npm run dev` para iniciar Next y el trabajador en la misma terminal. El supervisor reinicia al trabajador si falla, respeta la reserva compartida y permite su cierre para liberarla. `npm run dev:solo` conserva el arranque exclusivo de la interfaz. `npm run start:avisos` permite el arranque conjunto de una compilación; `npm start` sigue iniciando solamente Next. El trabajador independiente reactivado durante el diagnóstico permanece en segundo plano; las futuras instancias respetan su reserva.

`npm run notificaciones:estado` ofrece un diagnóstico de lectura con configuración, reserva y recuentos de colas. No imprime tokens, correos de pacientes ni contenido de citas, y no envía mensajes.

Validación: 159 pruebas unitarias aprobadas, sintaxis de los scripts correcta y arranque/cierre reales de una instancia temporal de producción en el puerto 3211. Se comprobó después que el trabajador original seguía activo y que no se duplicaron los envíos. La aplicación que el usuario ya tenía abierta no se detuvo. No se alteraron citas, horarios, expedientes ni correos de los pacientes.

El funcionamiento local depende de mantener el equipo encendido y el trabajador en ejecución. Para continuidad con el equipo apagado se necesita alojar el trabajador o configurar la automatización remota; no se activaron ni se comprobaron tareas de GitHub en esta intervención.
