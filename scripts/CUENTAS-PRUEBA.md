# Cuentas de prueba

El login incorpora el selector de roles de la rama Gabriel. Elegir una tarjeta rellena correo y contraseña; **Ingresar** sigue autenticando con Supabase y obtiene el rol del perfil guardado en la base.

Los accesos están activos por defecto con `npm run dev`. Para mostrarlos en una instalación de pruebas desplegada, agrega `HABILITAR_ACCESOS_PRUEBA=true` a sus variables de entorno y reinicia la aplicación. `HABILITAR_ACCESOS_PRUEBA=false` los oculta también en desarrollo. En producción están ocultos por defecto y la API no entrega los correos ni la clave.

Las cuentas se definen en `lib/cuenta/cuentas-prueba.json`. La contraseña de pruebas coincide con la de las cuentas actuales; `CLAVE_CUENTAS_PRUEBA` permite configurar otra si se han cambiado sus contraseñas en Supabase. Esta variable solo rellena el formulario: no cambia contraseñas en Auth.

`npm run cuentas:prueba` crea las cuentas faltantes de enfermero y recepcionista usando `.env.local` y vincula el perfil de enfermería a la clínica. Comprueba primero las cuentas existentes, conserva sus contraseñas y roles, y no duplica perfiles al ejecutarse otra vez. Recepción utiliza su fila de `usuarios` con el rol `recepcionista`; no necesita una tabla adicional de perfiles.

Verificación del login: `npx playwright test tests/e2e/accesos-prueba.spec.ts`. La API que controla la visibilidad tiene pruebas en `tests/accesos-prueba.test.mjs`, incluidas en `npm run test:unit`.
