begin;
alter table telegram_envios add column reintentos_manuales integer not null default 0;
alter table correo_envios add column reintentos_manuales integer not null default 0;
create table gestion_operaciones(autor bigint not null references usuarios(id),clave uuid not null,solicitud jsonb not null,respuesta jsonb not null,creado_en timestamptz not null default clock_timestamp(),primary key(autor,clave));
alter table gestion_operaciones enable row level security;revoke all on gestion_operaciones from public,anon,authenticated;grant all on gestion_operaciones to service_role;

create function public.clinica_notificacion_vigente(p_notificacion bigint) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from notificaciones n join usuarios u on u.id=n.usuario_id and u.esta_activo left join citas c on c.id=n.cita_id where n.id=p_notificacion and n.creado_en>clock_timestamp()-interval '23 hours'
 and (n.cita_inicio is null or n.cita_id is not null)
 and (n.cita_id is null or n.tipo='solicitud_cambio' or n.cita_version=md5(concat_ws(':',extract(epoch from c.inicio),extract(epoch from c.fin),c.medico_id,c.paciente_id,c.estado)))
 and (n.tipo not like 'recordatorio_%' or(c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp()))
 and (n.tipo not in('cita_nueva','cita_reprogramada') or(c.estado in('pendiente','confirmada') and c.inicio>clock_timestamp()))
 and (n.espera_oferta_id is null or exists(select 1 from espera_ofertas o join lista_espera l on l.id=o.entrada_id join perfiles_pacientes p on p.id=l.paciente_id and p.usuario_id=n.usuario_id and p.esta_activo where o.id=n.espera_oferta_id and o.estado='pendiente' and o.vence_en>clock_timestamp() and l.estado='activa'))
 and (n.seguimiento_id is null or exists(select 1 from controles_seguimiento s join perfiles_pacientes p on p.id=s.paciente_id and p.usuario_id=n.usuario_id and p.esta_activo where s.id=n.seguimiento_id and s.estado='pendiente')))
$$;
create or replace function public.clinica_encolar_correo() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.tipo in('cita_nueva','cita_reprogramada','cita_estado','recordatorio_24h','recordatorio_2h','recordatorio_30m','espera_oferta','seguimiento') then
  insert into correo_envios(notificacion_id,correo) select new.id,lower(u.correo) from usuarios u join auth.users a on a.id=u.auth_user_id and a.email_confirmed_at is not null and lower(a.email)=lower(u.correo) join perfiles_pacientes p on p.usuario_id=u.id and p.esta_activo
  where u.id=new.usuario_id and u.rol='paciente' and u.esta_activo and u.correo_citas and u.correo not ilike '%@clinica.local'
  and (exists(select 1 from citas c where c.id=new.cita_id and c.paciente_id=p.id) or exists(select 1 from espera_ofertas o join lista_espera l on l.id=o.entrada_id where o.id=new.espera_oferta_id and l.paciente_id=p.id) or exists(select 1 from controles_seguimiento s where s.id=new.seguimiento_id and s.paciente_id=p.id)) on conflict do nothing;
 end if;return new;
end $$;
alter function public.clinica_correo_vigente(bigint,uuid) rename to clinica_correo_vigente_v34;
revoke all on function clinica_correo_vigente_v34(bigint,uuid) from public,anon,authenticated,service_role;
create function public.clinica_correo_vigente(p_id bigint,p_arrendamiento uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r jsonb;e correo_envios;n notificaciones;
begin
 select * into e from correo_envios where id=p_id and arrendamiento=p_arrendamiento and estado='enviando';
 select * into n from notificaciones where id=e.notificacion_id;
 if e.id is null or not clinica_notificacion_vigente(n.id) then return null;end if;
 if n.tipo not in('espera_oferta','seguimiento') then r:=clinica_correo_vigente_v34(p_id,p_arrendamiento);if r is not null then r:=jsonb_set(r,'{cita}',(r->'cita')||jsonb_build_object('consultorio',(select consultorio_registrado from citas where id=n.cita_id)));end if;return r;end if;
 if not exists(select 1 from usuarios u join auth.users a on a.id=u.auth_user_id and a.email_confirmed_at is not null and lower(a.email)=e.correo where u.id=n.usuario_id and u.esta_activo and u.correo_citas and lower(u.correo)=e.correo) then return null;end if;
 return jsonb_build_object('id',e.id,'correo',e.correo,'titulo',n.titulo,'tipo',n.tipo,'mensaje',n.mensaje,'cita',null);
end $$;

alter function public.clinica_generar_recordatorios(timestamptz) rename to clinica_generar_recordatorios_v34;
revoke all on function clinica_generar_recordatorios_v34(timestamptz) from public,anon,authenticated,service_role;
create function public.clinica_generar_recordatorios(p_ahora timestamptz default clock_timestamp()) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;r integer;o espera_ofertas;
begin
 n:=clinica_generar_recordatorios_v34(p_ahora);
 for o in update espera_ofertas set estado='vencida' where estado='pendiente' and vence_en<=p_ahora returning * loop
  perform clinica_espera_siguiente(o.medico_id,o.inicio,null);
 end loop;
 insert into notificaciones(usuario_id,tipo,titulo,mensaje,clave,seguimiento_id)
 select p.usuario_id,'seguimiento','Recuerda programar tu control','Tienes un control indicado para el '||to_char(s.fecha,'DD/MM/YYYY')||'. Revisa Mis controles para buscar una cita. Este aviso no es una reserva.',concat('control:',s.id,':',s.revision,':previo'),s.id
 from controles_seguimiento s join perfiles_pacientes p on p.id=s.paciente_id and p.esta_activo join usuarios u on u.id=p.usuario_id and u.esta_activo
 where s.estado='pendiente' and s.fecha>=(p_ahora at time zone 'America/Mexico_City')::date and (s.fecha-s.dias_aviso+time '09:00') at time zone 'America/Mexico_City'<=p_ahora and s.creado_en<p_ahora-interval '5 minutes' on conflict(usuario_id,clave) do nothing;
 get diagnostics r=row_count;n:=n+r;
 insert into notificaciones(usuario_id,tipo,titulo,mensaje,clave,seguimiento_id)
 select p.usuario_id,'seguimiento','Tu control sigue pendiente','Todavía tienes un control por programar. Revisa Mis controles o comunícate con la clínica para coordinarlo.',concat('control:',s.id,':',s.revision,':vencido'),s.id
 from controles_seguimiento s join perfiles_pacientes p on p.id=s.paciente_id and p.esta_activo join usuarios u on u.id=p.usuario_id and u.esta_activo where s.estado='pendiente' and s.fecha=(p_ahora at time zone 'America/Mexico_City')::date-7 on conflict(usuario_id,clave) do nothing;
 get diagnostics r=row_count;return n+r;
end $$;
revoke all on function clinica_generar_recordatorios(timestamptz) from public,anon,authenticated;grant execute on function clinica_generar_recordatorios(timestamptz) to service_role;

create function public.clinica_responder_espera_telegram(p_chat bigint,p_oferta uuid,p_accion text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t telegram_cuentas;o espera_ofertas;
begin
  select * into t from telegram_cuentas where chat_id=p_chat and activo;
  select oo.* into o from espera_ofertas oo join lista_espera l on l.id=oo.entrada_id join perfiles_pacientes pp on pp.id=l.paciente_id and pp.usuario_id=t.usuario_id where oo.id=p_oferta;
  if t.usuario_id is null or o.id is null or o.telegram_vinculado_en is distinct from t.vinculado_en then raise exception 'Esta oferta no corresponde al vínculo de Telegram' using errcode='42501';end if;
  return clinica_espera_responder_actor(t.usuario_id,o.id,p_accion,'telegram');
end $$;
revoke all on function clinica_responder_espera_telegram(bigint,uuid,text) from public,anon,authenticated;grant execute on function clinica_responder_espera_telegram(bigint,uuid,text) to service_role;

alter function public.clinica_operar_telegram(uuid,text,jsonb) rename to clinica_operar_telegram_v34;
revoke all on function clinica_operar_telegram_v34(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.clinica_operar_telegram(p_reserva uuid,p_operacion text,p_datos jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb;n notificaciones;t telegram_cuentas;o espera_ofertas;u bigint;
begin
 if p_operacion='respuestaEspera' then
  if not clinica_reservar_trabajador(p_reserva) then raise exception 'RESERVA_OCUPADA' using errcode='55P03';end if;
  return jsonb_build_array(jsonb_build_object('r',clinica_responder_espera_telegram((p_datos->>0)::bigint,(p_datos->>1)::uuid,p_datos->>2)));
 end if;
 r:=clinica_operar_telegram_v34(p_reserva,p_operacion,p_datos);
 if p_operacion in('envioVigente','citasPropias') then r:=coalesce((select jsonb_agg(case when x->'cita' is not null and x->'cita'<>'null'::jsonb then jsonb_set(x,'{cita}',(x->'cita')||jsonb_build_object('consultorio',(select consultorio_registrado from citas where id=(x->'cita'->>'id')::bigint))) else x end) from jsonb_array_elements(r) x),'[]'::jsonb);end if;
 if p_operacion='envioVigente' then
  select nn.* into n from notificaciones nn join telegram_envios e on e.notificacion_id=nn.id where e.id=(p_datos->>0)::bigint;
  if not clinica_notificacion_vigente(n.id) then return '[]'::jsonb;end if;
  if n.espera_oferta_id is not null then r:=coalesce((select jsonb_agg(x||jsonb_build_object('ofertaId',n.espera_oferta_id)) from jsonb_array_elements(r) x),'[]'::jsonb);end if;
 end if;
 return r;
end $$;
revoke all on function clinica_operar_telegram(uuid,text,jsonb) from public,anon,authenticated;grant execute on function clinica_operar_telegram(uuid,text,jsonb) to service_role;

create function public.clinica_envios_panel(p_estado text default null,p_canal text default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r text:=clinica_rol();
begin
 perform clinica_requerir_sesion();if r is null or r not in('admin','recepcionista') then raise exception 'Sin acceso a comunicaciones' using errcode='42501';end if;
 if p_estado is not null and p_estado not in('pendiente','enviando','enviado','omitido','fallido') or p_canal is not null and p_canal not in('correo','telegram') then raise exception 'Filtro inválido';end if;
 return jsonb_build_object('ahora',clock_timestamp(),'trabajadorActivo',exists(select 1 from telegram_trabajador where id=1 and reserva is not null and vence_en>clock_timestamp()),'envios',coalesce((select jsonb_agg(to_jsonb(q) order by q.fecha desc,q.id desc) from(
  select e.id,'correo' canal,e.estado,e.intentos,e.reintentos_manuales reintentos,e.codigo_error codigo,e.enviado_en aceptado,n.creado_en fecha,n.titulo,n.tipo,u.nombre_completo destinatario,u.correo contacto,n.cita_id cita,n.espera_oferta_id oferta,n.seguimiento_id seguimiento
  from correo_envios e join notificaciones n on n.id=e.notificacion_id join usuarios u on u.id=n.usuario_id
  where n.creado_en>clock_timestamp()-interval '30 days' and (r='admin' or u.rol='paciente' and n.tipo in('cita_nueva','cita_estado','cita_reprogramada','recordatorio_24h','recordatorio_2h','recordatorio_30m','espera_oferta','seguimiento')) and (p_estado is null or e.estado=p_estado) and (p_canal is null or p_canal='correo')
  union all
  select e.id,'telegram',e.estado,e.intentos,e.reintentos_manuales,e.codigo_error,e.enviado_en,n.creado_en,n.titulo,n.tipo,u.nombre_completo,'Cuenta vinculada',n.cita_id,n.espera_oferta_id,n.seguimiento_id
  from telegram_envios e join notificaciones n on n.id=e.notificacion_id join usuarios u on u.id=n.usuario_id
  where n.creado_en>clock_timestamp()-interval '30 days' and (r='admin' or u.rol='paciente' and n.tipo in('cita_nueva','cita_estado','cita_reprogramada','recordatorio_24h','recordatorio_2h','recordatorio_30m','espera_oferta','seguimiento')) and (p_estado is null or e.estado=p_estado) and (p_canal is null or p_canal='telegram')
  order by fecha desc,id desc limit 200) q),'[]'::jsonb));
end $$;
create function public.clinica_envios_reintentar(p_datos jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n notificaciones;e correo_envios;t telegram_envios;r text:=clinica_rol();
begin
 if r is null or r not in('admin','recepcionista') then raise exception 'Sin acceso a comunicaciones' using errcode='42501';end if;
 if p_datos->>'canal'='correo' then
  select * into e from correo_envios where id=(p_datos->>'id')::bigint for update;select * into n from notificaciones where id=e.notificacion_id;
  if e.id is null or e.estado not in('pendiente','fallido') or e.reintentos_manuales>=3 then raise exception 'El envío no permite otro reintento';end if;
  if not exists(select 1 from usuarios u join auth.users a on a.id=u.auth_user_id and a.email_confirmed_at is not null and lower(a.email)=e.correo where u.id=n.usuario_id and u.correo_citas and lower(u.correo)=e.correo) then raise exception 'El correo cambió, no está verificado o sus avisos están desactivados';end if;
 elsif p_datos->>'canal'='telegram' then
  select * into t from telegram_envios where id=(p_datos->>'id')::bigint for update;select * into n from notificaciones where id=t.notificacion_id;
  if t.id is null or t.estado not in('pendiente','fallido') or t.reintentos_manuales>=3 then raise exception 'El envío no permite otro reintento';end if;
  if not exists(select 1 from telegram_cuentas where usuario_id=n.usuario_id and activo) then raise exception 'El destinatario debe volver a vincular Telegram';end if;
 else raise exception 'Canal inválido';end if;
 if r='recepcionista' and not exists(select 1 from usuarios where id=n.usuario_id and rol='paciente' and n.tipo in('cita_nueva','cita_estado','cita_reprogramada','recordatorio_24h','recordatorio_2h','recordatorio_30m','espera_oferta','seguimiento')) then raise exception 'Envío fuera de tu acceso' using errcode='42501';end if;
 if not clinica_notificacion_vigente(n.id) then raise exception 'El aviso venció o ya no corresponde al estado actual. No se reenviará';end if;
 if p_datos->>'canal'='correo' then update correo_envios set estado='pendiente',intentos=0,reintentos_manuales=reintentos_manuales+1,proximo_intento=clock_timestamp(),codigo_error=null where id=e.id;
 else update telegram_envios set estado='pendiente',intentos=0,reintentos_manuales=reintentos_manuales+1,proximo_intento=clock_timestamp(),codigo_error=null where id=t.id;end if;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(auth.uid(),(select nombre_completo from usuarios where auth_user_id=auth.uid()),'envios',n.id::text,'REINTENTAR',jsonb_build_object('canal',p_datos->>'canal'));
 return jsonb_build_object('ok',true,'mensaje','Reintento encolado. El trabajador volverá a verificar la vigencia antes de enviarlo.');
end $$;

create function public.clinica_reportes_panel(p_desde date,p_hasta date,p_medico bigint default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare resultado jsonb;
begin
 perform clinica_requerir_sesion();if clinica_rol() is distinct from 'admin' then raise exception 'Los reportes administrativos son exclusivos de administración' using errcode='42501';end if;
 if p_desde is null or p_hasta is null or p_hasta<p_desde or p_hasta-p_desde>366 or p_hasta>(clock_timestamp() at time zone 'America/Mexico_City')::date then raise exception 'Selecciona un periodo de hasta 366 días, sin fechas futuras';end if;
 if p_medico is not null and not exists(select 1 from perfiles_medicos where id=p_medico) then raise exception 'Médico inválido';end if;
 with datos as(
  select c.*,u.nombre_completo medico,(c.inicio at time zone 'America/Mexico_City')::date dia,
   case when l.en_consulta>=l.llegada then extract(epoch from(l.en_consulta-l.llegada))/60 end espera,
   case when c.estado='atendida' and e.estado_nota='cerrada' and e.cerrada_en>=l.en_consulta then extract(epoch from(e.cerrada_en-l.en_consulta))/60 end duracion
  from citas c join perfiles_medicos m on m.id=c.medico_id join usuarios u on u.id=m.usuario_id left join recepcion_llegadas l on l.cita_id=c.id and l.inicio_cita=c.inicio left join expedientes e on e.cita_id=c.id
  where c.inicio>=p_desde::timestamp at time zone 'America/Mexico_City' and c.inicio<(p_hasta+1)::timestamp at time zone 'America/Mexico_City' and (p_medico is null or c.medico_id=p_medico)
 ),por_medico as(
  select medico_id id,medico,count(*) total,count(*) filter(where estado='atendida') atendidas,count(*) filter(where estado::text like 'cancelada%') canceladas,count(*) filter(where estado='no_asistio') inasistencias,count(*) filter(where estado in('pendiente','confirmada')) pendientes,round(avg(espera),1) espera, count(espera) muestra_espera,round(avg(duracion),1) duracion,count(duracion) muestra_duracion from datos group by medico_id,medico
 ) select jsonb_build_object('desde',p_desde,'hasta',p_hasta,'total',(select count(*) from datos),'atendidas',(select count(*) from datos where estado='atendida'),'canceladas',(select count(*) from datos where estado::text like 'cancelada%'),'inasistencias',(select count(*) from datos where estado='no_asistio'),
 'porMedico',coalesce((select jsonb_agg(to_jsonb(q) order by q.medico) from por_medico q),'[]'::jsonb),
 'porDia',coalesce((select jsonb_agg(jsonb_build_object('dia',d::date,'total',(select count(*) from datos where dia=d::date),'atendidas',(select count(*) from datos where dia=d::date and estado='atendida')) order by d) from generate_series(p_desde,p_hasta,interval '1 day') d),'[]'::jsonb),
 'medicos',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'nombre',u.nombre_completo)) from perfiles_medicos m join usuarios u on u.id=m.usuario_id),'[]'::jsonb)) into resultado;
 return resultado;
end $$;

create function public.clinica_operar_modulo(p_modulo text,p_accion text,p_datos jsonb,p_clave uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u bigint;anterior gestion_operaciones;solicitud jsonb;r jsonb;
begin
 perform clinica_requerir_sesion();select id into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if u is null or p_clave is null or jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>6000 then raise exception 'Solicitud inválida';end if;
 perform pg_advisory_xact_lock(37201,0);solicitud:=jsonb_build_object('modulo',p_modulo,'accion',p_accion,'datos',p_datos);
 select * into anterior from gestion_operaciones where autor=u and clave=p_clave;
 if found then if anterior.solicitud is distinct from solicitud then raise exception 'La solicitud ya se usó para otros datos' using errcode='40001';end if;return anterior.respuesta;end if;
 if p_modulo='consultorios' then r:=clinica_consultorios_mutar(p_accion,p_datos);
 elsif p_modulo='espera' then r:=clinica_espera_mutar(p_accion,p_datos);
 elsif p_modulo='controles' then r:=clinica_controles_mutar(p_accion,p_datos);
 elsif p_modulo='envios' and p_accion='reintentar' then r:=clinica_envios_reintentar(p_datos);
 else raise exception 'Módulo o acción inválidos';end if;
 insert into gestion_operaciones(autor,clave,solicitud,respuesta) values(u,p_clave,solicitud,r);return r;
end $$;
revoke all on function clinica_notificacion_vigente(bigint),clinica_correo_vigente(bigint,uuid),clinica_envios_reintentar(jsonb) from public,anon,authenticated,service_role;
revoke all on function clinica_operar_modulo(text,text,jsonb,uuid),clinica_reportes_panel(date,date,bigint),clinica_envios_panel(text,text) from public,anon;
grant execute on function clinica_operar_modulo(text,text,jsonb,uuid),clinica_reportes_panel(date,date,bigint),clinica_envios_panel(text,text) to authenticated;
create function public.clinica_citas_ubicadas(p_datos jsonb) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_set(p_datos,'{citas}',coalesce((select jsonb_agg(x||jsonb_build_object('consultorio',c.consultorio_registrado) order by ord) from jsonb_array_elements(p_datos->'citas') with ordinality as a(x,ord) join citas c on c.id=(x->>'id')::bigint),'[]'::jsonb))
$$;
revoke all on function clinica_citas_ubicadas(jsonb) from public,anon,authenticated,service_role;
alter function public.clinica_portal_paciente() rename to clinica_portal_paciente_v34;
revoke all on function clinica_portal_paciente_v34() from public,anon,authenticated,service_role;
create function public.clinica_portal_paciente() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin perform clinica_requerir_sesion();return clinica_citas_ubicadas(clinica_portal_paciente_v34());end $$;
revoke all on function clinica_portal_paciente() from public,anon;grant execute on function clinica_portal_paciente() to authenticated;
alter function public.clinica_medico_panel(date) rename to clinica_medico_panel_v34;
revoke all on function clinica_medico_panel_v34(date) from public,anon,authenticated,service_role;
create function public.clinica_medico_panel(p_dia date default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin perform clinica_requerir_sesion();return clinica_citas_ubicadas(clinica_medico_panel_v34(p_dia));end $$;
revoke all on function clinica_medico_panel(date) from public,anon;grant execute on function clinica_medico_panel(date) to authenticated;
alter function public.clinica_recepcion_panel(date) rename to clinica_recepcion_panel_v34;
revoke all on function clinica_recepcion_panel_v34(date) from public,anon,authenticated,service_role;
create function public.clinica_recepcion_panel(p_dia date default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin perform clinica_requerir_sesion();return clinica_citas_ubicadas(clinica_recepcion_panel_v34(p_dia));end $$;
revoke all on function clinica_recepcion_panel(date) from public,anon;grant execute on function clinica_recepcion_panel(date) to authenticated;

create or replace function public.clinica_version() returns integer language sql stable as $$select 37$$;
notify pgrst,'reload schema';commit;
