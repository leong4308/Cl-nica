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
3. Ejecuta `pnpm db:actualizar`. Aplica únicamente `018_seguridad_y_auditoria.sql` y `019_transacciones_clinicas.sql`, comprueba sus hashes y registra las versiones. Si existen citas solapadas o ingresos activos duplicados, se detiene sin eliminarlos. Resuelve los conflictos antes de volver a ejecutar.
4. Ejecuta `pnpm agenda:importar` para copiar las agendas privadas anteriores a PostgreSQL sin sobrescribir las ya publicadas. No se inventan horarios.
5. También se pueden ejecutar ambos archivos SQL, en ese orden, desde el editor de Supabase. La importación de agendas sigue siendo necesaria si había horarios guardados en Storage.
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
