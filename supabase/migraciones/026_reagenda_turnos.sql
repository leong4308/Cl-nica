begin;
create table public.telegram_turnos_cita (
 token uuid primary key default gen_random_uuid(), accion uuid not null references public.telegram_acciones_cita(token) on delete cascade,
 inicio timestamptz not null, fin timestamptz not null, vence_en timestamptz not null
);
alter table public.telegram_turnos_cita enable row level security;
revoke all on public.telegram_turnos_cita from public,anon,authenticated;
grant all on public.telegram_turnos_cita to service_role;

create function public.clinica_limite_reagenda() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.estado in('pendiente','confirmada') and clinica_version_reserva(new)<>clinica_version_reserva(old)
 and old.inicio<=clock_timestamp()+interval '2 hours' then
  raise exception 'Faltan dos horas o menos para la cita. Puedes confirmar asistencia o cancelar; ya no se permite reagendar';
 end if;
 return new;
end $$;
create trigger clinica_cita_limite_reagenda before update on public.citas for each row execute function public.clinica_limite_reagenda();
revoke all on function public.clinica_limite_reagenda() from public,anon,authenticated;

-- Protege también solicitudes antiguas enviadas desde mensajes anteriores del bot.
alter function public.clinica_responder_cita_actor(bigint,bigint,text,text,text,text) rename to clinica_responder_cita_actor_v24;
revoke all on function public.clinica_responder_cita_actor_v24(bigint,bigint,text,text,text,text) from public,anon,authenticated,service_role;
create function public.clinica_responder_cita_actor(p_usuario bigint,p_cita bigint,p_version text,p_accion text,p_disponibilidad text,p_canal text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c citas;
begin
 if p_accion='reagendar' then
  perform pg_advisory_xact_lock(37201,0);
  select c1.* into c from citas c1 join perfiles_pacientes p on p.id=c1.paciente_id join usuarios u on u.id=p.usuario_id
   where c1.id=p_cita and u.id=p_usuario and u.rol='paciente' and u.esta_activo and p.esta_activo for update of c1;
  if not found then raise exception 'Esta cita no pertenece a tu cuenta' using errcode='42501'; end if;
  if c.inicio<=clock_timestamp()+interval '2 hours' then raise exception 'Faltan dos horas o menos para la cita. Puedes confirmar asistencia o cancelar; ya no se permite reagendar'; end if;
 end if;
 return clinica_responder_cita_actor_v24(p_usuario,p_cita,p_version,p_accion,p_disponibilidad,p_canal);
end $$;
revoke all on function public.clinica_responder_cita_actor(bigint,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.clinica_responder_cita_actor(bigint,bigint,text,text,text,text) to service_role;

create function public.clinica_turnos_cita_actor(p_usuario bigint,p_cita bigint,p_version text,p_desde date default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c citas; m perfiles_medicos; config configuracion_agenda; b jsonb; d jsonb; turnos jsonb:='[]';
 dia date; desde date:=coalesce(p_desde,(now() at time zone 'America/Mexico_City')::date);
 hoy date:=(now() at time zone 'America/Mexico_City')::date; t timestamptz; f timestamptz; cierre timestamptz; paso integer; pausa boolean;
begin
 select c1.* into c from citas c1 join perfiles_pacientes p on p.id=c1.paciente_id join usuarios u on u.id=p.usuario_id
 where c1.id=p_cita and u.id=p_usuario and u.rol='paciente' and u.esta_activo and p.esta_activo;
 if not found then raise exception 'Esta cita no pertenece a tu cuenta' using errcode='42501'; end if;
 if p_version is distinct from clinica_version_reserva(c) then raise exception 'La cita cambió. Actualiza sus detalles antes de responder' using errcode='40001'; end if;
 if c.estado not in('pendiente','confirmada') or c.inicio<=clock_timestamp()+interval '2 hours' then
  return jsonb_build_object('permitido',false,'configurado',false,'turnos','[]'::jsonb,'motivo','Faltan dos horas o menos o la cita ya se cerró. Puedes confirmar asistencia o cancelar; ya no se permite reagendar.','limite',c.inicio-interval '2 hours');
 end if;
 if desde<hoy or desde>hoy+56 then raise exception 'Selecciona una semana dentro de los próximos 56 días'; end if;
 select pm.* into m from perfiles_medicos pm join usuarios u on u.id=pm.usuario_id join clinicas cl on cl.id=pm.clinica_id
 where pm.id=c.medico_id and pm.esta_activo and u.esta_activo and u.rol='medico' and cl.esta_activo;
 if not found then return jsonb_build_object('permitido',true,'configurado',false,'turnos','[]'::jsonb,'motivo','El médico no está disponible. Contacta con recepción.'); end if;
 select * into config from configuracion_agenda where medico_id=m.id;
 if not found or jsonb_array_length(config.bloques)=0 then
  return jsonb_build_object('permitido',true,'configurado',false,'turnos','[]'::jsonb,'motivo','El médico aún no tiene horario publicado. Contacta con recepción.');
 end if;
 for i in 0..6 loop
  dia:=desde+i;
  for b in select value from jsonb_array_elements(config.bloques) where (value->>'dia')::integer=extract(dow from dia)::integer loop
   paso:=coalesce((b->>'paso')::integer,m.duracion_consulta);
   if paso<5 or paso>240 then raise exception 'El horario publicado tiene un intervalo inválido'; end if;
   t:=(dia+(b->>'inicio')::time) at time zone 'America/Mexico_City';
   cierre:=(dia+(b->>'fin')::time) at time zone 'America/Mexico_City';
   while t+make_interval(mins=>m.duracion_consulta)<=cierre loop
    f:=t+make_interval(mins=>m.duracion_consulta); pausa:=false;
    if t>clock_timestamp() and (t<>c.inicio or f<>c.fin) then
     for d in select value from jsonb_array_elements(config.descansos) where (value->>'fecha')::date=dia loop
      if tstzrange(t,f,'[)') && tstzrange((dia+(d->>'inicio')::time) at time zone 'America/Mexico_City',(dia+(d->>'fin')::time) at time zone 'America/Mexico_City','[)') then pausa:=true; exit; end if;
     end loop;
     if not pausa and not exists(select 1 from citas otra where otra.id<>c.id and otra.estado in('pendiente','confirmada','atendida')
       and (otra.medico_id=c.medico_id or otra.paciente_id=c.paciente_id) and tstzrange(otra.inicio,otra.fin,'[)') && tstzrange(t,f,'[)')) then
      turnos:=turnos||jsonb_build_array(jsonb_build_object('inicio',t,'fin',f));
     end if;
    end if;
    t:=t+make_interval(mins=>paso);
   end loop;
  end loop;
 end loop;
 select coalesce(jsonb_agg(x order by x->>'inicio'),'[]'::jsonb) into turnos from(select distinct value x from jsonb_array_elements(turnos)) q;
 return jsonb_build_object('permitido',true,'configurado',true,'turnos',turnos,'desde',desde,'hasta',desde+6,'limite',c.inicio-interval '2 hours','motivo',case when jsonb_array_length(turnos)=0 then 'No hay turnos libres en esta semana.' else null end);
end $$;
revoke all on function public.clinica_turnos_cita_actor(bigint,bigint,text,date) from public,anon,authenticated;

create function public.clinica_turnos_cita(p_cita bigint,p_version text,p_desde date default null) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select clinica_turnos_cita_actor((select id from usuarios where auth_user_id=auth.uid() and esta_activo),p_cita,p_version,p_desde)
$$;
revoke all on function public.clinica_turnos_cita(bigint,text,date) from public,anon;
grant execute on function public.clinica_turnos_cita(bigint,text,date) to authenticated;

create function public.clinica_reagendar_turno_actor(p_usuario bigint,p_cita bigint,p_version text,p_inicio timestamptz,p_canal text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c citas; u usuarios; opciones jsonb; elegido jsonb;
begin
 perform pg_advisory_xact_lock(37201,0);
 select * into u from usuarios where id=p_usuario and rol='paciente' and esta_activo;
 if not found then raise exception 'Cuenta de paciente sin acceso' using errcode='42501'; end if;
 select * into c from citas where id=p_cita and paciente_id in(select id from perfiles_pacientes where usuario_id=u.id and esta_activo) for update;
 if not found then raise exception 'Esta cita no pertenece a tu cuenta' using errcode='42501'; end if;
 if p_canal is null or p_canal not in('aplicacion','telegram') then raise exception 'Canal inválido'; end if;
 if p_inicio is null then raise exception 'Selecciona un horario disponible'; end if;
 opciones:=clinica_turnos_cita_actor(u.id,c.id,p_version,(p_inicio at time zone 'America/Mexico_City')::date);
 if not (opciones->>'permitido')::boolean then raise exception 'Faltan dos horas o menos para la cita. Puedes confirmar asistencia o cancelar; ya no se permite reagendar'; end if;
 select value into elegido from jsonb_array_elements(opciones->'turnos') where (value->>'inicio')::timestamptz=p_inicio;
 if elegido is null then raise exception 'Este horario ya no está disponible. Actualiza la agenda y elige otro' using errcode='23P01'; end if;
 update cita_solicitudes_cambio set estado='reagendada',respuesta='El paciente eligió un horario disponible desde '||p_canal||'.',actualizado_en=clock_timestamp() where cita_id=c.id and estado='pendiente';
 begin
  update citas set inicio=p_inicio,fin=(elegido->>'fin')::timestamptz,estado='confirmada',motivo_cancelacion=null,actualizado_en=clock_timestamp() where id=c.id;
 exception when exclusion_violation then raise exception 'Este horario acaba de ocuparse. Actualiza la agenda y elige otro' using errcode='23P01'; end;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,anterior,nuevo)
 values(u.auth_user_id,u.nombre_completo,'citas',c.id::text,'REAGENDAR_PACIENTE',jsonb_build_object('inicio',c.inicio,'fin',c.fin),jsonb_build_object('inicio',p_inicio,'fin',elegido->>'fin','canal',p_canal));
 return jsonb_build_object('mensaje','Tu cita se reagendó y tu asistencia quedó confirmada. Se avisó al médico y a recepción.','inicio',p_inicio,'fin',elegido->>'fin');
end $$;
revoke all on function public.clinica_reagendar_turno_actor(bigint,bigint,text,timestamptz,text) from public,anon,authenticated;
create function public.clinica_reagendar_turno(p_cita bigint,p_version text,p_inicio timestamptz) returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select clinica_reagendar_turno_actor((select id from usuarios where auth_user_id=auth.uid() and esta_activo),p_cita,p_version,p_inicio,'aplicacion')
$$;
revoke all on function public.clinica_reagendar_turno(bigint,text,timestamptz) from public,anon;
grant execute on function public.clinica_reagendar_turno(bigint,text,timestamptz) to authenticated;

create function public.clinica_accion_telegram(p_token uuid,p_chat bigint) returns telegram_acciones_cita language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a telegram_acciones_cita;
begin
 select ac.* into a from telegram_acciones_cita ac join telegram_cuentas t on t.usuario_id=ac.usuario_id and t.activo and t.chat_id=p_chat and t.vinculado_en=ac.vinculado_en
 join usuarios u on u.id=t.usuario_id and u.rol='paciente' and u.esta_activo join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo
 join citas c on c.id=ac.cita_id and c.paciente_id=p.id
 where ac.token=p_token and ac.vence_en>clock_timestamp() and c.inicio>clock_timestamp() and ac.version=clinica_version_reserva(c);
 if not found then raise exception 'Este mensaje venció o la cita cambió. Usa /citas para actualizarla' using errcode='40001'; end if;
 return a;
end $$;
revoke all on function public.clinica_accion_telegram(uuid,bigint) from public,anon,authenticated;

create function public.clinica_telegram_turnos(p_token uuid,p_chat bigint,p_fecha date default null,p_pagina integer default 0) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a telegram_acciones_cita; datos jsonb; fechas jsonb; fecha date; lista jsonb; opciones jsonb:='[]'; x jsonb; id_turno uuid; total integer;
begin
 a:=clinica_accion_telegram(p_token,p_chat);
 if p_pagina is null or p_pagina<0 or p_pagina>50 then raise exception 'Página inválida'; end if;
 datos:=clinica_turnos_cita_actor(a.usuario_id,a.cita_id,a.version,null);
 if not coalesce((datos->>'permitido')::boolean,false) or not coalesce((datos->>'configurado')::boolean,false) then return datos; end if;
 select coalesce(jsonb_agg(d order by d),'[]'::jsonb) into fechas from(select distinct ((value->>'inicio')::timestamptz at time zone 'America/Mexico_City')::date d from jsonb_array_elements(datos->'turnos')) q;
 fecha:=coalesce(p_fecha,(fechas->>0)::date);
 select coalesce(jsonb_agg(value order by value->>'inicio'),'[]'::jsonb) into lista from jsonb_array_elements(datos->'turnos') where ((value->>'inicio')::timestamptz at time zone 'America/Mexico_City')::date=fecha;
 total:=jsonb_array_length(lista);
 for x in select value from jsonb_array_elements(lista) with ordinality r(value,n) where n>p_pagina*6 and n<=p_pagina*6+6 loop
  insert into telegram_turnos_cita(accion,inicio,fin,vence_en) values(a.token,(x->>'inicio')::timestamptz,(x->>'fin')::timestamptz,least(clock_timestamp()+interval '10 minutes',a.vence_en,(select inicio-interval '2 hours' from citas where id=a.cita_id))) returning token into id_turno;
  opciones:=opciones||jsonb_build_array(x||jsonb_build_object('token',id_turno));
 end loop;
 return jsonb_build_object('permitido',true,'configurado',true,'dias',fechas,'fecha',fecha,'pagina',p_pagina,'total',total,'opciones',opciones,'cita_id',a.cita_id,'accion',a.token,'limite',datos->'limite','motivo',datos->'motivo');
end $$;
revoke all on function public.clinica_telegram_turnos(uuid,bigint,date,integer) from public,anon,authenticated;
create function public.clinica_telegram_reagendar(p_turno uuid,p_chat bigint) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t telegram_turnos_cita; a telegram_acciones_cita;
begin
 select * into t from telegram_turnos_cita where token=p_turno;
 if not found then raise exception 'Horario no disponible. Usa /citas para actualizar la agenda'; end if;
 a:=clinica_accion_telegram(t.accion,p_chat);
 if t.vence_en<=clock_timestamp() then raise exception 'Este horario venció. Usa /citas y elige un turno actualizado'; end if;
 return clinica_reagendar_turno_actor(a.usuario_id,a.cita_id,a.version,t.inicio,'telegram');
end $$;
revoke all on function public.clinica_telegram_reagendar(uuid,bigint) from public,anon,authenticated;

-- Mantiene las operaciones HTTPS instaladas y añade solo las dos operaciones nuevas.
alter function public.clinica_operar_telegram(uuid,text,jsonb) rename to clinica_operar_telegram_v25;
revoke all on function public.clinica_operar_telegram_v25(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.clinica_operar_telegram(p_reserva uuid,p_operacion text,p_datos jsonb default '[]') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb;
begin
 if p_operacion not in('turnosCita','reagendarTurno') then return clinica_operar_telegram_v25(p_reserva,p_operacion,p_datos); end if;
 if jsonb_typeof(p_datos) is distinct from 'array' or jsonb_array_length(p_datos)>4 then raise exception 'Parámetros inválidos'; end if;
 update telegram_trabajador set vence_en=clock_timestamp()+interval '5 minutes' where id=1 and reserva=p_reserva and vence_en>clock_timestamp();
 if not found then raise exception 'Reserva del trabajador vencida' using errcode='55000'; end if;
 if p_operacion='turnosCita' then r:=clinica_telegram_turnos((p_datos->>0)::uuid,(p_datos->>1)::bigint,(p_datos->>2)::date,coalesce((p_datos->>3)::integer,0));
 else r:=clinica_telegram_reagendar((p_datos->>0)::uuid,(p_datos->>1)::bigint); end if;
 return jsonb_build_array(jsonb_build_object('r',r));
end $$;
revoke all on function public.clinica_operar_telegram(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.clinica_operar_telegram(uuid,text,jsonb) to service_role;
create or replace function public.clinica_version() returns integer language sql stable as $$select 26$$;
notify pgrst,'reload schema';
commit;
