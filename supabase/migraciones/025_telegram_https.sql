begin;
create table public.telegram_trabajador(id integer primary key check(id=1),reserva uuid,vence_en timestamptz not null default 'epoch');
insert into public.telegram_trabajador(id) values(1);
alter table public.telegram_trabajador enable row level security;
revoke all on public.telegram_trabajador from public,anon,authenticated;
grant all on public.telegram_trabajador to service_role;
create function public.clinica_reservar_trabajador(p_reserva uuid,p_liberar boolean default false) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_reserva is null then return false; end if;
 if p_liberar then
  update telegram_trabajador set reserva=null,vence_en='epoch' where id=1 and reserva=p_reserva;
 else
  update telegram_trabajador set reserva=p_reserva,vence_en=clock_timestamp()+interval '5 minutes' where id=1 and (reserva=p_reserva or vence_en<clock_timestamp());
 end if;
 return found;
end $$;
-- Lista cerrada de operaciones; nunca ejecuta SQL suministrado por el cliente.
-- Cada llamada renueva una reserva exclusiva, compartida por todas las instancias.
create function public.clinica_operar_telegram(p_reserva uuid,p_operacion text,p_datos jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $rpc$
declare v_sql text; resultado jsonb;
begin
 if jsonb_typeof(p_datos) is distinct from 'array' or jsonb_array_length(p_datos)>6 then raise exception 'Parámetros inválidos'; end if;
 update telegram_trabajador set vence_en=clock_timestamp()+interval '5 minutes' where id=1 and reserva=p_reserva and vence_en>clock_timestamp();
 if not found then raise exception 'Reserva del trabajador vencida' using errcode='55000'; end if;
 case p_operacion
 when 'control' then v_sql:=$q$select ultimo_update from telegram_control where id=1$q$;
 when 'avanzarControl' then v_sql:=$q$update telegram_control set ultimo_update=greatest(ultimo_update,($1::bigint)) where id=1 returning 1$q$;
 when 'recibirVinculo' then v_sql:=$q$update telegram_vinculos set chat_id=($1::bigint),nombre=($2::text),recibido_en=clock_timestamp()
        where token_hash=($3::text) and vence_en>clock_timestamp() and confirmado_en is null and chat_id is null returning id$q$;
 when 'desactivarChat' then v_sql:=$q$update telegram_cuentas set activo=false where chat_id=($1::bigint) returning 1$q$;
 when 'vencerVinculos' then v_sql:=$q$update telegram_vinculos set vence_en=clock_timestamp() where chat_id=($1::bigint) and confirmado_en is null returning 1$q$;
 when 'reclamar' then v_sql:=$q$select * from clinica_reclamar_telegram(25)$q$;
 when 'envioVigente' then v_sql:=$q$select n.usuario_id,n.tipo,case when c.id is not null then jsonb_build_object(
      'id',c.id,'inicio',c.inicio,'fin',c.fin,'estado',c.estado,'version',clinica_version_reserva(c),'paciente',up.nombre_completo,
      'medico',um.nombre_completo,'clinica',cl.nombre,'direccion',cl.direccion) end as cita
      from telegram_envios e join notificaciones n on n.id=e.notificacion_id
      join telegram_cuentas t on t.usuario_id=n.usuario_id and t.activo and t.chat_id=($3::bigint)
      join usuarios u on u.id=t.usuario_id and u.esta_activo left join citas c on c.id=n.cita_id
      left join perfiles_pacientes p on p.id=c.paciente_id left join usuarios up on up.id=p.usuario_id
      left join perfiles_medicos m on m.id=c.medico_id left join usuarios um on um.id=m.usuario_id
      left join clinicas cl on cl.id=c.clinica_id
      where e.id=($1::bigint) and e.arrendamiento=($2::uuid) and e.estado='enviando'
      and (n.cita_inicio is null or n.cita_id is not null)
      and (n.cita_id is null or n.tipo='solicitud_cambio' or n.cita_version=md5(concat_ws(':',extract(epoch from c.inicio),extract(epoch from c.fin),c.medico_id,c.paciente_id,c.estado)))
      and (n.tipo not like 'recordatorio_%' or(c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp()))
      and (n.tipo<>'cita_nueva' or c.estado in('pendiente','confirmada'))
      and (n.tipo<>'solicitud_cambio' or exists(select 1 from cita_solicitudes_cambio s where s.cita_id=n.cita_id and s.estado='pendiente'
        and strpos(n.mensaje,'Disponibilidad del paciente: '||s.disponibilidad||'. La cita actual se conserva')>0))$q$;
 when 'omitir' then v_sql:=$q$update telegram_envios set estado='omitido',reservado_hasta=null where id=($1::bigint) and arrendamiento=($2::uuid) returning 1$q$;
 when 'marcarEnviado' then v_sql:=$q$update telegram_envios set estado='enviado',enviado_en=clock_timestamp(),reservado_hasta=null,codigo_error=null where id=($1::bigint) and arrendamiento=($2::uuid) returning 1$q$;
 when 'errorEnvio' then v_sql:=$q$update telegram_envios set estado=case when intentos>=5 or ($3::text)='403' then 'fallido' else 'pendiente' end,
        codigo_error=($3::text),reservado_hasta=null,proximo_intento=clock_timestamp()+make_interval(secs=>greatest(($4::integer),60*intentos))
        where id=($1::bigint) and arrendamiento=($2::uuid) returning 1$q$;
 when 'crearAccion' then v_sql:=$q$insert into telegram_acciones_cita(usuario_id,cita_id,version,vence_en,vinculado_en)
    select u.id,c.id,clinica_version_reserva(c),least(c.inicio,clock_timestamp()+interval '48 hours'),t.vinculado_en
    from citas c join perfiles_pacientes p on p.id=c.paciente_id and p.esta_activo
    join usuarios u on u.id=p.usuario_id and u.esta_activo and u.rol='paciente'
    join telegram_cuentas t on t.usuario_id=u.id and t.activo
    where c.id=($1::bigint) and u.id=($2::bigint) and c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp()
    and clinica_version_reserva(c)=($3::text) and c.estado::text=($4::text)
    returning token$q$;
 when 'leerAccion' then v_sql:=$q$select a.*,c.estado from telegram_acciones_cita a
    join telegram_cuentas t on t.usuario_id=a.usuario_id and t.activo and t.chat_id=($2::bigint) and t.vinculado_en=a.vinculado_en
    join usuarios u on u.id=t.usuario_id and u.esta_activo and u.rol='paciente'
    join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo
    join citas c on c.id=a.cita_id and c.paciente_id=p.id
    where a.token=($1::uuid) and a.vence_en>clock_timestamp() and c.inicio>clock_timestamp()
    and a.version=clinica_version_reserva(c)$q$;
 when 'guardarPregunta' then v_sql:=$q$update telegram_acciones_cita set pregunta_id=($2::bigint),pregunta_hasta=clock_timestamp()+interval '30 minutes' where token=($1::uuid) returning 1$q$;
 when 'responderSimple' then v_sql:=$q$select clinica_responder_cita_actor(($1::bigint),($2::bigint),($3::text),($4::text),null,($5::text)) r$q$;
 when 'citasPropias' then v_sql:=$q$select u.id usuario_id,jsonb_build_object('id',c.id,'inicio',c.inicio,'fin',c.fin,'estado',c.estado,'version',clinica_version_reserva(c),
      'paciente',u.nombre_completo,'medico',um.nombre_completo,'clinica',cl.nombre,'direccion',cl.direccion) cita
      from telegram_cuentas t join usuarios u on u.id=t.usuario_id and u.esta_activo and u.rol='paciente'
      join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo join citas c on c.paciente_id=p.id
      join perfiles_medicos med on med.id=c.medico_id join usuarios um on um.id=med.usuario_id join clinicas cl on cl.id=c.clinica_id
      where t.activo and t.chat_id=($1::bigint) and c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp() order by c.inicio limit 5$q$;
 when 'salirPregunta' then v_sql:=$q$update telegram_acciones_cita a set pregunta_id=null,pregunta_hasta=null from telegram_cuentas t where t.usuario_id=a.usuario_id and t.chat_id=($1::bigint) and t.activo returning 1$q$;
 when 'buscarPregunta' then v_sql:=$q$select a.token from telegram_acciones_cita a join telegram_cuentas t on t.usuario_id=a.usuario_id and t.activo
    where t.chat_id=($1::bigint) and a.pregunta_id=($2::bigint) and a.pregunta_hasta>clock_timestamp()$q$;
 when 'responderDisponibilidad' then v_sql:=$q$select clinica_responder_cita_actor(($1::bigint),($2::bigint),($3::text),($4::text),($5::text),($6::text)) r$q$;
 when 'cerrarPregunta' then v_sql:=$q$update telegram_acciones_cita set pregunta_id=null,pregunta_hasta=null where token=($1::uuid) returning 1$q$;
 when 'recordatorios' then v_sql:=$q$select clinica_generar_recordatorios() as generados$q$;
 else raise exception 'Operación no permitida' using errcode='42501';
 end case;
 execute 'with filas as ('||v_sql||') select coalesce(jsonb_agg(to_jsonb(filas)),''[]''::jsonb) from filas' into resultado
 using p_datos->>0,p_datos->>1,p_datos->>2,p_datos->>3,p_datos->>4,p_datos->>5;
 return resultado;
end $rpc$;
revoke all on function public.clinica_reservar_trabajador(uuid,boolean),public.clinica_operar_telegram(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.clinica_reservar_trabajador(uuid,boolean),public.clinica_operar_telegram(uuid,text,jsonb) to service_role;
create or replace function public.clinica_version() returns integer language sql stable as $$select 25$$;
notify pgrst,'reload schema';
commit;
