# Revisión de Clínica Nova · 16 de noviembre de 2026

Revisión completada sobre la rama **Erick**, a partir del commit `5ef8b9192a528dc8d8e5effc8b38b4b081da66ef` (`cambios finales v2`), con las correcciones descritas abajo pendientes de commit. No se realizó una fusión ni un envío a `main`.

| Componente | Versión comprobada |
| --- | --- |
| Aplicación (`package.json`) | 0.1.0 |
| Base Supabase (`clinica_version()`) | **41**, instalada y comprobada |
| Migraciones registradas | 24: de 018 a 041, con SHA-256 coincidente |
| Next.js instalado y compilado | 16.3.3 |
| React instalado | 19.2.4 |
| Supabase JS instalado | 2.117.2 |
| TypeScript | 5.7.3 |
| Node.js utilizado | 22.14.0 |

La versión del paquete y la de la base son identificadores distintos. No se cambió arbitrariamente `0.1.0` por una versión de lanzamiento. El endpoint administrativo `/api/sistema/estado` exige ahora la base 41 y respondió `baseActualizada: true`. No se comprobó una versión desplegada en un dominio público ni se consultaron ramas remotas nuevas.

## Recorrido y permisos

| Rol | Flujo revisado | Límite comprobado |
| --- | --- | --- |
| Administración | Horarios, consultorios, habitaciones/camas, asignaciones, autorización de personal y reportes | El panel de agenda médica personal y el portal del paciente no se presentan como propios. La consulta administrativa requiere seleccionar una cita. |
| Recepción | Registro, invitación de acceso, cita, confirmación, llegada y solicitudes administrativas | Sin lectura directa de expedientes, notas, resultados ni panel de enfermería. |
| Médico | Pacientes vinculados, inicio tras llegada, borrador, cierre, órdenes, revisión de resultados y control posterior | Sin consultas ajenas; validar laboratorio requiere un permiso independiente. |
| Enfermería | Asignación y turno, signos, cuidados/medicación prescrita, muestras y salida autorizada | Sin prescripción ni validación de resultados; el acceso termina al finalizar la asignación. |
| Paciente | Sesión propia, reserva, respuesta a citas, resultados publicados, consultas cerradas, controles y datos personales | Sin directorios ni paneles del personal; la identidad se obtiene de la sesión. |

El nuevo recorrido SQL aislado enlaza: publicación de agenda y consultorio → registro e invitación → reserva/confirmación → llegada → signos → consulta y nota cerrada → orden ambulatoria → toma/entrega de muestra → validación autorizada → resultado del paciente → control y cita posterior → métricas. También comprueba hospitalización, etapas de muestras, idempotencia, cancelación de órdenes, acceso a otro paciente y vencimiento del turno de enfermería.

Las suites existentes cubren además cancelación/reagenda con más de dos horas de anticipación, lista de espera, notificaciones, bloqueo por inactividad, recuperación de acceso, PDF y Excel. La nueva prueba usa un reloj controlado únicamente dentro de PGlite; no modifica el reloj ni los datos de Supabase.

## Fallos corregidos durante la revisión

1. **Muestras ambulatorias:** enfermería solo recibía estudios originados en hospitalización. La migración 040 incluye también órdenes de consulta, conservando la asignación al paciente y la restricción del turno. Exige toma antes de entrega, rechaza órdenes canceladas y evita duplicados. No permite escribir resultados ni indicaciones desde ese registro.
2. **Creación de órdenes hospitalarias:** `INSERT ... RETURNING` podía fallar porque la política consultaba la propia fila recién insertada mediante una función `STABLE`. La migración 041 comprueba el episodio existente y conserva las políticas restrictivas. La regresión comprueba el identificador devuelto y rechaza médico ajeno, recepción, enfermería y paciente.
3. **Autor e indicaciones:** al buscar/crear el episodio para una nueva orden, el cliente obtiene el médico desde la sesión y utiliza su episodio. Las instrucciones permanecen en la orden, sin escribirlas como observaciones del resultado que exigirían autorización de laboratorio.

Las migraciones 040 y 041 quedaron instaladas mediante el instalador con control de hashes. Se conservó un respaldo cifrado verificado antes de instalarlas, con base y tres documentos. La comparación de contenido anterior/posterior confirmó que no cambiaron citas, expedientes, órdenes ni solicitudes de laboratorio existentes.

## Evidencia de verificación

| Comprobación | Resultado |
| --- | --- |
| Pruebas unitarias | **150 aprobadas** |
| Suite SQL aislada | **111 aprobadas** |
| Recorrido SQL nuevo, repetido tras los ajustes finales | **11 aprobadas**, incluidas sus subpruebas |
| Suite completa de interfaz en Chrome | **114 aprobadas** |
| Formularios clínicos y enfermería, repetidos con la compilación final | **14 aprobadas** |
| TypeScript (`tsc --noEmit`) | Sin errores |
| Compilación de producción (`next build`) | Correcta |
| API compilada con cinco cuentas reales y sin sesión | **36 respuestas con el estado HTTP esperado** |
| Login, paneles RPC y restricciones RLS de cinco cuentas reales | Correctos, antes y después de actualizar |
| Integridad de migraciones y contenido clínico existente | Comprobada |

Las pruebas de interfaz simulan servicios y errores para comprobar formularios, navegación y conservación de datos. Las escrituras del recorrido clínico se ejecutan en una base temporal. La verificación real inicia sesiones de prueba y lee los accesos; no crea citas, modifica expedientes ni envía mensajes a pacientes. Al terminar se cerraron solo las sesiones creadas para la revisión.

## Condiciones pendientes de operación

- **Correo:** hay configuración de Resend, pero el remitente sigue siendo `onboarding@resend.dev`. Para enviar a pacientes distintos del propietario de Resend hace falta verificar un dominio y configurar `EMAIL_FROM` con ese dominio.
- **Enlaces externos:** `APP_URL` apunta a una dirección local. Las invitaciones y enlaces abiertos desde otro equipo requieren la URL pública del despliegue y sus redirecciones de autenticación configuradas.
- **Recordatorios y Telegram:** no había una reserva activa del trabajador al comprobarlo. Para el servicio continuo debe mantenerse `node scripts/notificaciones.mjs` ejecutándose, o comprobar la configuración y ejecuciones del workflow remoto. No se verificó su ejecución en GitHub ni se mandaron mensajes de prueba durante esta revisión.

Las comprobaciones anteriores validan los casos indicados; no certifican ausencia absoluta de fallos ni un despliegue público listo. Para publicar esta revisión deben incluirse sus archivos de código, pruebas y migraciones, conservando fuera de Git los secretos, respaldos y herramientas privadas. Los logs y resultados temporales se eliminan con `node scripts/limpiar.mjs`; las pruebas funcionales y migraciones se conservan para mantenimiento y CI.
