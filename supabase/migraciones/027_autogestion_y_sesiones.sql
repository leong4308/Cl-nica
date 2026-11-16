begin;
create table public.sesiones_clinica (
 id uuid primary key,auth_user_id uuid not null references auth.users(id) on delete cascade,
 ultimo_movimiento timestamptz not null default clock_timestamp(),bloqueada_en timestamptz,
 creado_en timestamptz not null default clock_timestamp()
);
alter table public.sesiones_clinica enable row level security;
revoke all on public.sesiones_clinica from public,anon,authenticated;
grant all on public.sesiones_clinica to service_role;
insert into public.sesiones_clinica(id,auth_user_id)
 select s.id,s.user_id from auth.sessions s join public.usuarios u on u.auth_user_id=s.user_id where u.esta_activo;

create function public.clinica_sesion_activa() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from sesiones_clinica s join auth.sessions a on a.id=s.id and a.user_id=s.auth_user_id
  where s.auth_user_id=auth.uid() and s.id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid
  and s.bloqueada_en is null and s.ultimo_movimiento>clock_timestamp()-interval '15 minutes')
$$;
revoke all on function public.clinica_sesion_activa() from public,anon;
grant execute on function public.clinica_sesion_activa() to authenticated,service_role;
create function public.clinica_requerir_sesion() returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not clinica_sesion_activa() then raise exception 'Tu sesión está bloqueada. Verifica tu contraseña para continuar' using errcode='42501'; end if;
end $$;
revoke all on function public.clinica_requerir_sesion() from public,anon;
grant execute on function public.clinica_requerir_sesion() to authenticated;
create function public.clinica_estado_sesion(p_accion text default 'estado') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid; s sesiones_clinica;
begin
 if p_accion is null or p_accion not in('estado','actividad','bloquear') then raise exception 'Acción de sesión inválida'; end if;
 if auth.uid() is null or sid is null or not exists(select 1 from usuarios where auth_user_id=auth.uid() and esta_activo)
 or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then raise exception 'Verifica tu acceso para continuar' using errcode='42501'; end if;
 insert into sesiones_clinica(id,auth_user_id) values(sid,auth.uid()) on conflict do nothing;
 select * into s from sesiones_clinica where id=sid and auth_user_id=auth.uid() for update;
 if not found then raise exception 'La sesión no pertenece a esta cuenta' using errcode='42501'; end if;
 if p_accion='bloquear' or s.ultimo_movimiento<=clock_timestamp()-interval '15 minutes' then
  update sesiones_clinica set bloqueada_en=coalesce(bloqueada_en,clock_timestamp()) where id=sid returning * into s;
 elsif p_accion='actividad' and s.bloqueada_en is null then
  update sesiones_clinica set ultimo_movimiento=clock_timestamp() where id=sid returning * into s;
 end if;
 -- Ninguna petición, renovación de JWT ni latido puede desbloquear una sesión vencida.
 return jsonb_build_object('id',sid,'bloqueada',s.bloqueada_en is not null,'ultimaActividad',s.ultimo_movimiento,'venceInactividad',s.ultimo_movimiento+interval '15 minutes','servidorAhora',clock_timestamp());
end $$;
revoke all on function public.clinica_estado_sesion(text) from public,anon;
grant execute on function public.clinica_estado_sesion(text) to authenticated;
create or replace function public.clinica_rol() returns text language sql stable security definer set search_path=public,pg_temp as $$
 select rol::text from usuarios where auth_user_id=auth.uid() and esta_activo and clinica_sesion_activa()
$$;

-- Las tablas que lee el navegador se protegen también contra acceso REST directo.
do $politicas$ declare t text; begin
 foreach t in array array['perfiles_medicos','perfiles_enfermeros','perfiles_pacientes','citas','expedientes','internaciones','episodios_medicos','ordenes_medicas','solicitudes_analisis','paciente_medicos','auditoria_clinica','configuracion_agenda','clinicas','camas','habitaciones','catalogo_analisis','notificaciones','cita_solicitudes_cambio'] loop
  execute format('create policy sesion_clinica_activa on public.%I as restrictive for all to authenticated using((select public.clinica_sesion_activa())) with check((select public.clinica_sesion_activa()))',t);
 end loop;
end $politicas$;
create policy sesion_usuario_lectura on public.usuarios as restrictive for select to authenticated using(auth_user_id=auth.uid() or (select clinica_sesion_activa()));
create policy sesion_usuario_insertar on public.usuarios as restrictive for insert to authenticated with check((select clinica_sesion_activa()));
create policy sesion_usuario_editar on public.usuarios as restrictive for update to authenticated using((select clinica_sesion_activa())) with check((select clinica_sesion_activa()));
create policy sesion_usuario_borrar on public.usuarios as restrictive for delete to authenticated using((select clinica_sesion_activa()));

-- Estas tres entradas no dependían de clinica_rol; ahora requieren sesión activa.
alter function public.clinica_responder_cita(bigint,text,text,text) rename to clinica_responder_cita_v26;
revoke all on function public.clinica_responder_cita_v26(bigint,text,text,text) from public,anon,authenticated,service_role;
create function public.clinica_responder_cita(p_cita bigint,p_version text,p_accion text,p_disponibilidad text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin perform clinica_requerir_sesion(); return clinica_responder_cita_actor((select id from usuarios where auth_user_id=auth.uid() and esta_activo),p_cita,p_version,p_accion,p_disponibilidad,'aplicacion'); end $$;
revoke all on function public.clinica_responder_cita(bigint,text,text,text) from public,anon;
grant execute on function public.clinica_responder_cita(bigint,text,text,text) to authenticated;
alter function public.clinica_turnos_cita(bigint,text,date) rename to clinica_turnos_cita_v26;
revoke all on function public.clinica_turnos_cita_v26(bigint,text,date) from public,anon,authenticated,service_role;
create function public.clinica_turnos_cita(p_cita bigint,p_version text,p_desde date default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin perform clinica_requerir_sesion(); return clinica_turnos_cita_actor((select id from usuarios where auth_user_id=auth.uid() and esta_activo),p_cita,p_version,p_desde); end $$;
revoke all on function public.clinica_turnos_cita(bigint,text,date) from public,anon;
grant execute on function public.clinica_turnos_cita(bigint,text,date) to authenticated;
alter function public.clinica_reagendar_turno(bigint,text,timestamptz) rename to clinica_reagendar_turno_v26;
revoke all on function public.clinica_reagendar_turno_v26(bigint,text,timestamptz) from public,anon,authenticated,service_role;
create function public.clinica_reagendar_turno(p_cita bigint,p_version text,p_inicio timestamptz) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin perform clinica_requerir_sesion(); return clinica_reagendar_turno_actor((select id from usuarios where auth_user_id=auth.uid() and esta_activo),p_cita,p_version,p_inicio,'aplicacion'); end $$;
revoke all on function public.clinica_reagendar_turno(bigint,text,timestamptz) from public,anon;
grant execute on function public.clinica_reagendar_turno(bigint,text,timestamptz) to authenticated;

create table public.reservas_paciente (
 usuario_id bigint not null references usuarios(id),clave uuid not null,cita_id bigint references citas(id) on delete set null,
 medico_id bigint not null,inicio timestamptz not null,fin timestamptz not null,motivo text not null,
 primary key(usuario_id,clave)
);
create table public.telegram_reservas (
 token uuid primary key default gen_random_uuid(),usuario_id bigint not null references usuarios(id),
 vinculado_en timestamptz not null,medico_id bigint,vence_en timestamptz not null,cita_id bigint references citas(id) on delete set null
);
create table public.telegram_horas_reserva (
 token uuid primary key default gen_random_uuid(),reserva uuid not null references telegram_reservas(token) on delete cascade,
 medico_id bigint not null,inicio timestamptz not null,fin timestamptz not null,vence_en timestamptz not null
);
alter table public.reservas_paciente enable row level security;
alter table public.telegram_reservas enable row level security;
alter table public.telegram_horas_reserva enable row level security;
revoke all on public.reservas_paciente,public.telegram_reservas,public.telegram_horas_reserva from public,anon,authenticated;
grant all on public.reservas_paciente,public.telegram_reservas,public.telegram_horas_reserva to service_role;

create function public.clinica_turnos_reserva(p_paciente bigint,p_medico bigint,p_desde date default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare m perfiles_medicos; config configuracion_agenda; b jsonb; d jsonb; turnos jsonb:='[]';
 dia date; desde date:=coalesce(p_desde,(now() at time zone 'America/Mexico_City')::date);
 hoy date:=(now() at time zone 'America/Mexico_City')::date; t timestamptz; f timestamptz; cierre timestamptz; paso integer; pausa boolean;
begin
 if desde<hoy or desde>hoy+56 then raise exception 'Selecciona una semana dentro de los próximos 56 días'; end if;
 select pm.* into m from perfiles_medicos pm join usuarios u on u.id=pm.usuario_id join clinicas cl on cl.id=pm.clinica_id
 where pm.id=p_medico and pm.esta_activo and u.esta_activo and u.rol='medico' and cl.esta_activo;
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
    if t>clock_timestamp() then
     for d in select value from jsonb_array_elements(config.descansos) where (value->>'fecha')::date=dia loop
      if tstzrange(t,f,'[)') && tstzrange((dia+(d->>'inicio')::time) at time zone 'America/Mexico_City',(dia+(d->>'fin')::time) at time zone 'America/Mexico_City','[)') then pausa:=true; exit; end if;
     end loop;
     if not pausa and not exists(select 1 from citas otra where true and otra.estado in('pendiente','confirmada','atendida')
       and (otra.medico_id=p_medico or otra.paciente_id=p_paciente) and tstzrange(otra.inicio,otra.fin,'[)') && tstzrange(t,f,'[)')) then
      turnos:=turnos||jsonb_build_array(jsonb_build_object('inicio',t,'fin',f));
     end if;
    end if;
    t:=t+make_interval(mins=>paso);
   end loop;
  end loop;
 end loop;
 select coalesce(jsonb_agg(x order by x->>'inicio'),'[]'::jsonb) into turnos from(select distinct value x from jsonb_array_elements(turnos)) q;
 return jsonb_build_object('permitido',true,'configurado',true,'turnos',turnos,'desde',desde,'hasta',desde+6,'motivo',case when jsonb_array_length(turnos)=0 then 'No hay turnos libres en esta semana.' else null end);
end $$;
revoke all on function public.clinica_turnos_reserva(bigint,bigint,date) from public,anon,authenticated;

create function public.clinica_datos_reserva_actor(p_usuario bigint) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u usuarios; p perfiles_pacientes; medicos jsonb;
begin
 select * into u from usuarios where id=p_usuario and rol='paciente' and esta_activo;
 select * into p from perfiles_pacientes where usuario_id=u.id and esta_activo;
 if u.id is null or p.id is null then raise exception 'No se encontró un paciente activo para tu cuenta' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.nombre),'[]') into medicos from(
  select m.id,um.nombre_completo nombre,m.especialidad,cl.nombre clinica,m.duracion_consulta,
   coalesce(jsonb_array_length(a.bloques)>0,false) publicado
  from perfiles_medicos m join usuarios um on um.id=m.usuario_id and um.esta_activo and um.rol='medico'
  join clinicas cl on cl.id=m.clinica_id and cl.esta_activo left join configuracion_agenda a on a.medico_id=m.id where m.esta_activo
 ) q;
 return jsonb_build_object('paciente',jsonb_build_object('nombre',u.nombre_completo,'correo',u.correo,'telefono',u.telefono),'medicos',medicos);
end $$;
revoke all on function public.clinica_datos_reserva_actor(bigint) from public,anon,authenticated;
create function public.clinica_agenda_reserva(p_medico bigint default null,p_desde date default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare usuario bigint; paciente bigint;
begin
 perform clinica_requerir_sesion();
 select u.id,p.id into usuario,paciente from usuarios u join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo where u.auth_user_id=auth.uid() and u.rol='paciente' and u.esta_activo;
 if usuario is null then raise exception 'Esta opción es exclusiva del paciente' using errcode='42501'; end if;
 if p_medico is null then return clinica_datos_reserva_actor(usuario); end if;
 return clinica_turnos_reserva(paciente,p_medico,p_desde);
end $$;
revoke all on function public.clinica_agenda_reserva(bigint,date) from public,anon;
grant execute on function public.clinica_agenda_reserva(bigint,date) to authenticated;

create function public.clinica_agendar_paciente_actor(p_usuario bigint,p_medico bigint,p_inicio timestamptz,p_fin timestamptz,p_clave uuid,p_motivo text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios; p perfiles_pacientes; opciones jsonb; r citas; anterior reservas_paciente; motivo text:=coalesce(nullif(trim(p_motivo),''),'Consulta solicitada por el paciente');
begin
 perform pg_advisory_xact_lock(37201,0);
 select * into u from usuarios where id=p_usuario and rol='paciente' and esta_activo;
 select * into p from perfiles_pacientes where usuario_id=u.id and esta_activo;
 if u.id is null or p.id is null then raise exception 'No se encontró un paciente activo para tu cuenta' using errcode='42501'; end if;
 if p_clave is null or p_inicio is null or p_fin is null or length(motivo)>1000 then raise exception 'Selecciona un horario e indica un motivo de hasta 1000 caracteres'; end if;
 select * into anterior from reservas_paciente where usuario_id=u.id and clave=p_clave;
 if found then
  if anterior.medico_id<>p_medico or anterior.inicio<>p_inicio or anterior.fin<>p_fin or anterior.motivo<>motivo then raise exception 'Esta solicitud ya fue procesada. Inicia una nueva reserva' using errcode='40001'; end if;
  if anterior.cita_id is null then raise exception 'La cita de esta solicitud fue eliminada. Inicia otra reserva'; end if;
  select * into r from citas where id=anterior.cita_id;
  return jsonb_build_object('id',r.id,'inicio',r.inicio,'fin',r.fin,'estado',r.estado,'mensaje','Esta cita ya quedó registrada.');
 end if;
 opciones:=clinica_turnos_reserva(p.id,p_medico,(p_inicio at time zone 'America/Mexico_City')::date);
 if not exists(select 1 from jsonb_array_elements(opciones->'turnos') x where (x->>'inicio')::timestamptz=p_inicio and (x->>'fin')::timestamptz=p_fin) then
  raise exception 'Este horario ya no está disponible. Actualiza la agenda y elige otro' using errcode='23P01';
 end if;
 begin
  insert into citas(paciente_id,medico_id,clinica_id,inicio,fin,estado,motivo) select p.id,m.id,m.clinica_id,p_inicio,p_fin,'confirmada',motivo from perfiles_medicos m where m.id=p_medico returning * into r;
 exception when exclusion_violation then raise exception 'Este horario acaba de ocuparse. Elige otro' using errcode='23P01'; end;
 insert into reservas_paciente(usuario_id,clave,cita_id,medico_id,inicio,fin,motivo) values(u.id,p_clave,r.id,p_medico,p_inicio,p_fin,motivo);
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(u.auth_user_id,u.nombre_completo,'citas',r.id::text,'CITA_SOLICITADA_PACIENTE',jsonb_build_object('inicio',r.inicio,'medico_id',r.medico_id));
 return jsonb_build_object('id',r.id,'inicio',r.inicio,'fin',r.fin,'estado',r.estado,'mensaje','Tu cita quedó agendada y confirmada. Se avisó al médico y a recepción.');
end $$;
revoke all on function public.clinica_agendar_paciente_actor(bigint,bigint,timestamptz,timestamptz,uuid,text) from public,anon,authenticated;
create function public.clinica_agendar_paciente(p_medico bigint,p_inicio timestamptz,p_fin timestamptz,p_clave uuid,p_motivo text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform clinica_requerir_sesion();
 return clinica_agendar_paciente_actor((select id from usuarios where auth_user_id=auth.uid() and esta_activo),p_medico,p_inicio,p_fin,p_clave,p_motivo);
end $$;
revoke all on function public.clinica_agendar_paciente(bigint,timestamptz,timestamptz,uuid,text) from public,anon;
grant execute on function public.clinica_agendar_paciente(bigint,timestamptz,timestamptz,uuid,text) to authenticated;

create function public.clinica_reserva_telegram_actual(p_token uuid,p_chat bigint) returns telegram_reservas language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r telegram_reservas;
begin
 select a.* into r from telegram_reservas a join telegram_cuentas t on t.usuario_id=a.usuario_id and t.activo and t.chat_id=p_chat and t.vinculado_en=a.vinculado_en
 join usuarios u on u.id=a.usuario_id and u.rol='paciente' and u.esta_activo join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo
 where a.token=p_token and (a.vence_en>clock_timestamp() or a.cita_id is not null);
 if not found then raise exception 'La reserva venció o este Telegram no está vinculado. Usa /agendar para comenzar' using errcode='42501'; end if;
 return r;
end $$;
create function public.clinica_iniciar_reserva_telegram(p_chat bigint) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t telegram_cuentas; r telegram_reservas;
begin
 select c.* into t from telegram_cuentas c join usuarios u on u.id=c.usuario_id and u.rol='paciente' and u.esta_activo where c.chat_id=p_chat and c.activo;
 if not found then raise exception 'Vincula tu cuenta de paciente con Telegram desde la aplicación'; end if;
 insert into telegram_reservas(usuario_id,vinculado_en,vence_en) values(t.usuario_id,t.vinculado_en,clock_timestamp()+interval '30 minutes') returning * into r;
 return clinica_datos_reserva_actor(t.usuario_id)||jsonb_build_object('token',r.token);
end $$;
create function public.clinica_horas_reserva_telegram(p_token uuid,p_chat bigint,p_medico bigint default null,p_fecha date default null,p_pagina integer default 0) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r telegram_reservas; paciente bigint; datos jsonb; fechas jsonb; lista jsonb; fecha date; opciones jsonb:='[]'; x jsonb; token_hora uuid;
begin
 r:=clinica_reserva_telegram_actual(p_token,p_chat);
 if r.cita_id is not null then raise exception 'Esta solicitud ya creó una cita. Usa /citas o /agendar para otra reserva'; end if;
 if p_pagina is null or p_pagina<0 or p_pagina>50 then raise exception 'Página inválida'; end if;
 if p_medico is not null then update telegram_reservas set medico_id=p_medico where token=r.token returning * into r; end if;
 if r.medico_id is null then raise exception 'Elige un médico para continuar'; end if;
 select id into paciente from perfiles_pacientes where usuario_id=r.usuario_id and esta_activo;
 datos:=clinica_turnos_reserva(paciente,r.medico_id,null);
 if not coalesce((datos->>'configurado')::boolean,false) then return datos; end if;
 select coalesce(jsonb_agg(d order by d),'[]') into fechas from(select distinct ((value->>'inicio')::timestamptz at time zone 'America/Mexico_City')::date d from jsonb_array_elements(datos->'turnos')) q;
 fecha:=coalesce(p_fecha,(fechas->>0)::date);
 select coalesce(jsonb_agg(value order by value->>'inicio'),'[]') into lista from jsonb_array_elements(datos->'turnos') where ((value->>'inicio')::timestamptz at time zone 'America/Mexico_City')::date=fecha;
 for x in select value from jsonb_array_elements(lista) with ordinality q(value,n) where n>p_pagina*6 and n<=p_pagina*6+6 loop
  insert into telegram_horas_reserva(reserva,medico_id,inicio,fin,vence_en) values(r.token,r.medico_id,(x->>'inicio')::timestamptz,(x->>'fin')::timestamptz,least(r.vence_en,clock_timestamp()+interval '10 minutes')) returning token into token_hora;
  opciones:=opciones||jsonb_build_array(x||jsonb_build_object('token',token_hora));
 end loop;
 return jsonb_build_object('configurado',true,'token',r.token,'medico',(select u.nombre_completo from perfiles_medicos m join usuarios u on u.id=m.usuario_id where m.id=r.medico_id),'dias',fechas,'fecha',fecha,'pagina',p_pagina,'total',jsonb_array_length(lista),'opciones',opciones);
end $$;
create function public.clinica_resumen_reserva_telegram(p_turno uuid,p_chat bigint) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare t telegram_horas_reserva; r telegram_reservas;
begin
 select * into t from telegram_horas_reserva where token=p_turno;
 if not found then raise exception 'El horario no está disponible. Usa /agendar'; end if;
 r:=clinica_reserva_telegram_actual(t.reserva,p_chat);
 if t.medico_id is distinct from r.medico_id or (t.vence_en<=clock_timestamp() and r.cita_id is null) then raise exception 'Actualiza los horarios antes de confirmar'; end if;
 return (select jsonb_build_object('paciente',up.nombre_completo,'medico',um.nombre_completo,'clinica',cl.nombre,'direccion',cl.direccion,'inicio',t.inicio,'fin',t.fin,'token',t.token)
 from usuarios up join perfiles_medicos m on m.id=t.medico_id join usuarios um on um.id=m.usuario_id join clinicas cl on cl.id=m.clinica_id where up.id=r.usuario_id);
end $$;
create function public.clinica_confirmar_reserva_telegram(p_turno uuid,p_chat bigint) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t telegram_horas_reserva; r telegram_reservas; resultado jsonb;
begin
 perform clinica_resumen_reserva_telegram(p_turno,p_chat);
 select * into t from telegram_horas_reserva where token=p_turno;
 r:=clinica_reserva_telegram_actual(t.reserva,p_chat);
 resultado:=clinica_agendar_paciente_actor(r.usuario_id,t.medico_id,t.inicio,t.fin,r.token,null);
 update telegram_reservas set cita_id=(resultado->>'id')::bigint where token=r.token;
 return resultado||(select jsonb_build_object('paciente',up.nombre_completo,'medico',um.nombre_completo,'clinica',cl.nombre,'direccion',cl.direccion)
 from citas c join perfiles_pacientes p on p.id=c.paciente_id join usuarios up on up.id=p.usuario_id join perfiles_medicos m on m.id=c.medico_id join usuarios um on um.id=m.usuario_id join clinicas cl on cl.id=c.clinica_id where c.id=(resultado->>'id')::bigint);
end $$;
revoke all on function public.clinica_reserva_telegram_actual(uuid,bigint),public.clinica_iniciar_reserva_telegram(bigint),public.clinica_horas_reserva_telegram(uuid,bigint,bigint,date,integer),public.clinica_resumen_reserva_telegram(uuid,bigint),public.clinica_confirmar_reserva_telegram(uuid,bigint) from public,anon,authenticated;

alter function public.clinica_operar_telegram(uuid,text,jsonb) rename to clinica_operar_telegram_v26;
revoke all on function public.clinica_operar_telegram_v26(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.clinica_operar_telegram(p_reserva uuid,p_operacion text,p_datos jsonb default '[]') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb;
begin
 if p_operacion not in('iniciarReserva','horasReserva','resumenReserva','confirmarReserva') then return clinica_operar_telegram_v26(p_reserva,p_operacion,p_datos); end if;
 if jsonb_typeof(p_datos) is distinct from 'array' or jsonb_array_length(p_datos)>5 then raise exception 'Parámetros inválidos'; end if;
 update telegram_trabajador set vence_en=clock_timestamp()+interval '5 minutes' where id=1 and reserva=p_reserva and vence_en>clock_timestamp();
 if not found then raise exception 'Reserva del trabajador vencida' using errcode='55000'; end if;
 case p_operacion
  when 'iniciarReserva' then r:=clinica_iniciar_reserva_telegram((p_datos->>0)::bigint);
  when 'horasReserva' then r:=clinica_horas_reserva_telegram((p_datos->>0)::uuid,(p_datos->>1)::bigint,(p_datos->>2)::bigint,(p_datos->>3)::date,coalesce((p_datos->>4)::integer,0));
  when 'resumenReserva' then r:=clinica_resumen_reserva_telegram((p_datos->>0)::uuid,(p_datos->>1)::bigint);
  when 'confirmarReserva' then r:=clinica_confirmar_reserva_telegram((p_datos->>0)::uuid,(p_datos->>1)::bigint);
 end case;
 return jsonb_build_array(jsonb_build_object('r',r));
end $$;
revoke all on function public.clinica_operar_telegram(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.clinica_operar_telegram(uuid,text,jsonb) to service_role;
create or replace function public.clinica_version() returns integer language sql stable as $$select 27$$;
notify pgrst,'reload schema';
commit;
