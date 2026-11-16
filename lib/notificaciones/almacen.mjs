// Operaciones privadas del trabajador. El navegador nunca proporciona SQL.
export const CONSULTAS_TELEGRAM = {
  respuestaEspera: 'select clinica_responder_espera_telegram($1,$2,$3) r',
  iniciarReserva: 'select clinica_iniciar_reserva_telegram($1) r',
  horasReserva: 'select clinica_horas_reserva_telegram($1,$2,$3,$4::date,$5) r',
  resumenReserva: 'select clinica_resumen_reserva_telegram($1,$2) r',
  confirmarReserva: 'select clinica_confirmar_reserva_telegram($1,$2) r',
  turnosCita: `select clinica_telegram_turnos($1,$2,$3::date,$4) r`,
  reagendarTurno: `select clinica_telegram_reagendar($1,$2) r`,
  control: `select ultimo_update from telegram_control where id=1`,
  avanzarControl: `update telegram_control set ultimo_update=greatest(ultimo_update,$1) where id=1`,
  recibirVinculo: `update telegram_vinculos set chat_id=$1,nombre=$2,recibido_en=clock_timestamp()
        where token_hash=$3 and vence_en>clock_timestamp() and confirmado_en is null and chat_id is null returning id`,
  desactivarChat: `update telegram_cuentas set activo=false where chat_id=$1`,
  vencerVinculos: `update telegram_vinculos set vence_en=clock_timestamp() where chat_id=$1 and confirmado_en is null`,
  reclamar: `select * from clinica_reclamar_telegram(25)`,
  envioVigente: `select n.usuario_id,n.tipo,case when c.id is not null then jsonb_build_object(
      'id',c.id,'inicio',c.inicio,'fin',c.fin,'estado',c.estado,'version',clinica_version_reserva(c),'paciente',up.nombre_completo,
      'medico',um.nombre_completo,'clinica',cl.nombre,'direccion',cl.direccion) end as cita
      from telegram_envios e join notificaciones n on n.id=e.notificacion_id
      join telegram_cuentas t on t.usuario_id=n.usuario_id and t.activo and t.chat_id=$3
      join usuarios u on u.id=t.usuario_id and u.esta_activo left join citas c on c.id=n.cita_id
      left join perfiles_pacientes p on p.id=c.paciente_id left join usuarios up on up.id=p.usuario_id
      left join perfiles_medicos m on m.id=c.medico_id left join usuarios um on um.id=m.usuario_id
      left join clinicas cl on cl.id=c.clinica_id
      where e.id=$1 and e.arrendamiento=$2 and e.estado='enviando'
      and (n.cita_inicio is null or n.cita_id is not null)
      and (n.cita_id is null or n.tipo='solicitud_cambio' or n.cita_version=md5(concat_ws(':',extract(epoch from c.inicio),extract(epoch from c.fin),c.medico_id,c.paciente_id,c.estado)))
      and (n.tipo not like 'recordatorio_%' or(c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp()))
      and (n.tipo<>'cita_nueva' or c.estado in('pendiente','confirmada'))
      and (n.tipo<>'solicitud_cambio' or exists(select 1 from cita_solicitudes_cambio s where s.cita_id=n.cita_id and s.estado='pendiente'
        and strpos(n.mensaje,'Disponibilidad del paciente: '||s.disponibilidad||'. La cita actual se conserva')>0))`,
  omitir: `update telegram_envios set estado='omitido',reservado_hasta=null where id=$1 and arrendamiento=$2`,
  marcarEnviado: `update telegram_envios set estado='enviado',enviado_en=clock_timestamp(),reservado_hasta=null,codigo_error=null where id=$1 and arrendamiento=$2`,
  errorEnvio: `update telegram_envios set estado=case when intentos>=5 or $3='403' then 'fallido' else 'pendiente' end,
        codigo_error=$3,reservado_hasta=null,proximo_intento=clock_timestamp()+make_interval(secs=>greatest($4,60*intentos))
        where id=$1 and arrendamiento=$2`,
  crearAccion: `insert into telegram_acciones_cita(usuario_id,cita_id,version,vence_en,vinculado_en)
    select u.id,c.id,clinica_version_reserva(c),least(c.inicio,clock_timestamp()+interval '48 hours'),t.vinculado_en
    from citas c join perfiles_pacientes p on p.id=c.paciente_id and p.esta_activo
    join usuarios u on u.id=p.usuario_id and u.esta_activo and u.rol='paciente'
    join telegram_cuentas t on t.usuario_id=u.id and t.activo
    where c.id=$1 and u.id=$2 and c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp()
    and clinica_version_reserva(c)=$3 and c.estado::text=$4
    returning token`,
  leerAccion: `select a.*,c.estado from telegram_acciones_cita a
    join telegram_cuentas t on t.usuario_id=a.usuario_id and t.activo and t.chat_id=$2 and t.vinculado_en=a.vinculado_en
    join usuarios u on u.id=t.usuario_id and u.esta_activo and u.rol='paciente'
    join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo
    join citas c on c.id=a.cita_id and c.paciente_id=p.id
    where a.token=$1 and a.vence_en>clock_timestamp() and c.inicio>clock_timestamp()
    and a.version=clinica_version_reserva(c)`,
  guardarPregunta: `update telegram_acciones_cita set pregunta_id=$2,pregunta_hasta=clock_timestamp()+interval '30 minutes' where token=$1`,
  responderSimple: `select clinica_responder_cita_actor($1,$2,$3,$4,null,$5) r`,
  citasPropias: `select u.id usuario_id,jsonb_build_object('id',c.id,'inicio',c.inicio,'fin',c.fin,'estado',c.estado,'version',clinica_version_reserva(c),
      'paciente',u.nombre_completo,'medico',um.nombre_completo,'clinica',cl.nombre,'direccion',cl.direccion) cita
      from telegram_cuentas t join usuarios u on u.id=t.usuario_id and u.esta_activo and u.rol='paciente'
      join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo join citas c on c.paciente_id=p.id
      join perfiles_medicos med on med.id=c.medico_id join usuarios um on um.id=med.usuario_id join clinicas cl on cl.id=c.clinica_id
      where t.activo and t.chat_id=$1 and c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp() order by c.inicio limit 5`,
  salirPregunta: `update telegram_acciones_cita a set pregunta_id=null,pregunta_hasta=null from telegram_cuentas t where t.usuario_id=a.usuario_id and t.chat_id=$1 and t.activo`,
  buscarPregunta: `select a.token from telegram_acciones_cita a join telegram_cuentas t on t.usuario_id=a.usuario_id and t.activo
    where t.chat_id=$1 and a.pregunta_id=$2 and a.pregunta_hasta>clock_timestamp()`,
  responderDisponibilidad: `select clinica_responder_cita_actor($1,$2,$3,$4,$5,$6) r`,
  cerrarPregunta: `update telegram_acciones_cita set pregunta_id=null,pregunta_hasta=null where token=$1`,
  recordatorios: `select clinica_generar_recordatorios() as generados`,
}
export async function consultaTelegram(db, operacion, parametros = []) {
  if (!Object.hasOwn(CONSULTAS_TELEGRAM, operacion)) throw Error('OPERACION_TELEGRAM_INVALIDA')
  return db.operar ? db.operar(operacion, parametros) : db.query(CONSULTAS_TELEGRAM[operacion], parametros)
}
