# Enfermería y eliminaciones confirmadas

Referencia visual: origin/Gabriel, commit a707bf9. Se adapta su distribución a las API y permisos actuales; no se incorporan sus acciones de demostración.

Enfermería conserva seis vistas: Resumen, Pacientes, Citas, Internación, Órdenes médicas y Laboratorio. Los cuidados y la comunicación permanecen dentro de ellas. El paciente debe tener una asignación activa para consultar su información clínica. La ocupación se obtiene de las camas de su clínica. El censo operativo permite identificar al ocupante y médico; el historial clínico requiere asignación vigente.

Los médicos y recepción reciben y responden mensajes desde Equipo. Recepción solo participa en conversaciones operativas. Las conversaciones clínicas con paciente requieren acceso vigente de ambos participantes. El servidor verifica identidad, rol, sesión y permisos.

Administración no muestra Resumen. La eliminación usa el módulo y registro seleccionados, comprueba dependencias y exige motivo, confirmación y versión vigente. No permite eliminar ingresos activos ni arrastrar su historial clínico. Los PDF retirados dejan de estar disponibles en el registro y portal, con copia privada y auditoría. Si falla la operación de base, se intenta restaurar el archivo.

Las migraciones nuevas son 045 y 046. No se cambian migraciones previamente instaladas. Las pruebas usan datos aislados para no borrar registros, retirar PDF ni enviar mensajes reales.

Verificaciones: compilación de producción, pruebas unitarias, SQL aislado, recorridos de navegador en escritorio y móvil y comprobación de integración de solo lectura tras instalar. Los resultados efectivos se informan al terminar la revisión.

Resultados: compilación de producción correcta; 176 pruebas unitarias y 130 comprobaciones SQL aisladas aprobadas. Versión 46 instalada y verificada en la base real, con respaldo previo; nueve comprobaciones de integridad y acceso anónimo aprobadas. Los cinco roles iniciaron sesión y accedieron a sus paneles; los módulos ajenos devolvieron 403 y el paciente no accedió a comunicaciones del equipo. Las 32 pruebas de navegador aprobaron en Chrome: escritorio, móvil, cuidados, comunicación, sesión y eliminación confirmada. No se enviaron mensajes internos ni se eliminaron registros o PDF reales durante la revisión.

## Corrección posterior: admisión y censo (047–048)

El botón azul abre **Registrar ingreso urgente**, con selección directa de pacientes activos sin otra hospitalización, médico, cama, motivo y observaciones. No abre el compositor de mensajes. Los contactos con recepción y médico conservan sus botones independientes. Se exige confirmación y la transacción impide ocupar camas o duplicar hospitalizaciones; un reintento no duplica el ingreso.

Internación permite filtrar camas ocupadas, libres y fuera de servicio. Las ocupadas muestran paciente, médico, fecha de ingreso y una ventana de detalle. Las libres permiten abrir la admisión con la cama preseleccionada. Los nombres de habitación y cama se normalizan para evitar prefijos duplicados. El censo se limita a la clínica del enfermero y no revela diagnóstico ni historial sin asignación.

Validado: compilación, 26 pruebas unitarias relacionadas, 17 comprobaciones SQL de admisión y flujo completo, 15 recorridos de navegador de enfermería y equipo (incluido ingreso móvil), nueve comprobaciones de base real y acceso de los cinco roles. Versión 48 instalada con respaldo previo; lectura real confirmó siete pacientes disponibles, cinco camas libres y una ocupada con paciente y médico identificables. No se crearon hospitalizaciones ni se enviaron avisos de prueba a pacientes reales.
