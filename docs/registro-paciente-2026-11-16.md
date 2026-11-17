# Autorregistro de pacientes · 16 de noviembre de 2026

El login ofrece Registrarse y abre un formulario público en dos pasos. Son obligatorios nombre completo, teléfono, fecha de nacimiento, género, contacto de emergencia, teléfono de emergencia, correo y contraseña con confirmación. Los datos se conservan al cambiar de paso o ante un error del servicio.

`POST /api/auth/registro` valida y proyecta los campos antes de llamar a `auth.signUp` con el cliente público. No utiliza la clave de servicio para registrar, no permite elegir rol y no confirma el correo de forma administrativa. Las contraseñas no se incluyen en metadatos, respuestas ni auditoría. Supabase Auth conserva su confirmación de correo habilitada.

La migración 043 crea la ficha personal en la misma transacción que la cuenta Auth. El trigger anterior conserva la asignación fija de paciente; los metadatos públicos no conceden roles de personal, permiso de laboratorio, médicos asignados ni acceso a fichas ajenas. Las validaciones SQL rechazan datos incompletos o inválidos. Las fichas anteriores se activan mediante su invitación y no se enlazan automáticamente por coincidencia de correo.

Instalación real: respaldo cifrado verificado antes de aplicar la migración; `clinica_version()` devuelve 43. Se comprobaron el hash instalado, el trigger activo y la disponibilidad del registro mediante el cliente anónimo. La verificación real fue de lectura: no se crearon cuentas ni se enviaron correos a personas durante estas pruebas.

Validación: 166 pruebas unitarias y 118 pruebas SQL aisladas aprobadas; 18 casos de interfaz entre acceso por los cinco roles, invitaciones y registro, con repetición de los cuatro casos nuevos tras el ajuste final. La compilación de producción y la comprobación final de TypeScript de Next finalizaron correctamente. Se verificó el formulario móvil, campos obligatorios, discrepancia de contraseñas, conservación de datos, confirmación de correo y rechazo de metadatos de privilegios.

Para que un tester confirme su correo, Supabase Auth debe permitir entregar el mensaje a su dirección y autorizar el callback de la URL usada en Auth → URL Configuration. Ese servicio es distinto de los recordatorios de Resend del trabajador. Los errores de envío o límite se comunican sin simular éxito. No se desactivó la confirmación ni se comprobó la entrega real de una confirmación nueva en esta intervención.

Si la aplicación se ejecuta mediante `next start`, detén y vuelve a iniciar el servidor después de compilar para cargar la versión nueva. El comando directo compatible con PowerShell es `node .\scripts\aplicacion-con-avisos.mjs start --port 3001`.
