begin;
create table equipo_conversaciones(
 id uuid primary key, iniciador_id bigint not null references usuarios(id), destinatario_id bigint not null references usuarios(id),
 paciente_id bigint references perfiles_pacientes(id), ambito text not null check(ambito in('administrativo','clinico')),
 asunto text not null check(length(trim(asunto)) between 3 and 120), urgente boolean not null default false,
 creado_en timestamptz not null default clock_timestamp(), actualizado_en timestamptz not null default clock_timestamp(),
 iniciador_leido_en timestamptz, destinatario_leido_en timestamptz, check(iniciador_id<>destinatario_id)
);
create table equipo_mensajes(
 id uuid primary key, conversacion_id uuid not null references equipo_conversaciones(id), autor bigint not null references usuarios(id),
 contenido text not null check(length(trim(contenido)) between 1 and 3000), creado_en timestamptz not null default clock_timestamp()
);
create index equipo_conversaciones_destino on equipo_conversaciones(destinatario_id,actualizado_en desc);
create index equipo_mensajes_hilo on equipo_mensajes(conversacion_id,creado_en);

create function clinica_equipo_acceso_paciente(p_usuario bigint,p_paciente bigint) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from usuarios u where u.id=p_usuario and u.esta_activo and (
 u.rol='admin' or u.rol='recepcionista' or
 u.rol='enfermero' and exists(select 1 from perfiles_enfermeros e join enfermeria_turnos t on t.enfermero_id=e.id where e.usuario_id=u.id and e.esta_activo and t.paciente_id=p_paciente and not t.cancelado and t.inicio<=clock_timestamp() and t.fin>clock_timestamp()) or
 u.rol='medico' and exists(select 1 from perfiles_medicos m where m.usuario_id=u.id and m.esta_activo and (
 exists(select 1 from paciente_medicos pm where pm.medico_id=m.id and pm.paciente_id=p_paciente and pm.activo) or
 exists(select 1 from citas c where c.medico_id=m.id and c.paciente_id=p_paciente and c.estado in('pendiente','confirmada','atendida')) or
 exists(select 1 from internaciones i where i.medico_responsable_id=m.id and i.paciente_id=p_paciente and i.estado='activa')))))
$$;
revoke all on function clinica_equipo_acceso_paciente(bigint,bigint) from public,anon,authenticated,service_role;

create function clinica_equipo_hilo_permitido(p_hilo uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select clinica_sesion_activa() and exists(select 1 from equipo_conversaciones c join usuarios u on u.auth_user_id=auth.uid() and u.esta_activo
 where c.id=p_hilo and u.id in(c.iniciador_id,c.destinatario_id)
 and (c.paciente_id is null or clinica_equipo_acceso_paciente(u.id,c.paciente_id))
 and (c.ambito<>'clinico' or u.rol in('admin','medico','enfermero')))
$$;
revoke all on function clinica_equipo_hilo_permitido(uuid) from public,anon;
grant execute on function clinica_equipo_hilo_permitido(uuid) to authenticated;
alter table equipo_conversaciones enable row level security;
alter table equipo_mensajes enable row level security;
revoke all on equipo_conversaciones,equipo_mensajes from public,anon,authenticated;
grant select on equipo_conversaciones,equipo_mensajes to authenticated;
grant all on equipo_conversaciones,equipo_mensajes to service_role;
create policy equipo_hilos_propios on equipo_conversaciones for select to authenticated using(clinica_equipo_hilo_permitido(id));
create policy equipo_mensajes_propios on equipo_mensajes for select to authenticated using(clinica_equipo_hilo_permitido(conversacion_id));

create function clinica_equipo_operar(p_accion text,p_datos jsonb,p_clave uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u usuarios;d usuarios;c equipo_conversaciones;m equipo_mensajes;p bigint;h uuid;texto text;ambito text;asunto text;destino bigint;
begin
 perform clinica_requerir_sesion();select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if u.id is null or u.rol not in('admin','medico','enfermero','recepcionista') then raise exception 'No tienes acceso al equipo' using errcode='42501';end if;
 if jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>5000 or p_clave is null then raise exception 'Revisa los datos del mensaje' using errcode='23514';end if;
 if p_accion='enviar' then
  destino:=(p_datos->>'destinatario')::bigint;select * into d from usuarios where id=destino and esta_activo and rol in('admin','medico','enfermero','recepcionista');
  if d.id is null or d.id=u.id then raise exception 'Selecciona un integrante activo del equipo' using errcode='23514';end if;
  p:=nullif(p_datos->>'pacienteId','')::bigint;ambito:=p_datos->>'ambito';asunto:=trim(p_datos->>'asunto');texto:=trim(p_datos->>'contenido');
  if ambito is null or ambito not in('administrativo','clinico') or asunto is null or length(asunto) not between 3 and 120 or texto is null or length(texto) not between 1 and 3000 then raise exception 'Completa asunto y mensaje con la extensión indicada' using errcode='23514';end if;
  if ambito='clinico' and (u.rol='recepcionista' or d.rol='recepcionista' or p is null) then raise exception 'Los mensajes clínicos necesitan un paciente de la atención de ambos profesionales' using errcode='42501';end if;
  if p is not null and (not exists(select 1 from perfiles_pacientes where id=p and esta_activo) or not clinica_equipo_acceso_paciente(u.id,p) or not clinica_equipo_acceso_paciente(d.id,p)) then raise exception 'El paciente no está asignado a la atención de ambos participantes' using errcode='42501';end if;
  select * into c from equipo_conversaciones where id=p_clave;
  if found then
   select * into m from equipo_mensajes where id=p_clave;
   if c.iniciador_id<>u.id or c.destinatario_id<>d.id or c.paciente_id is distinct from p or c.ambito<>ambito or c.asunto<>asunto or m.contenido<>texto or c.urgente is distinct from coalesce((p_datos->>'urgente')::boolean,false) then raise exception 'La solicitud cambió; vuelve a abrir el mensaje' using errcode='40001';end if;
   return jsonb_build_object('ok',true,'id',c.id);
  end if;
  insert into equipo_conversaciones(id,iniciador_id,destinatario_id,paciente_id,ambito,asunto,urgente,iniciador_leido_en)
  values(p_clave,u.id,d.id,p,ambito,asunto,coalesce((p_datos->>'urgente')::boolean,false),clock_timestamp()) returning * into c;
  h:=c.id;
 elsif p_accion in('responder','leer') then
  h:=(p_datos->>'id')::uuid;
  if not clinica_equipo_hilo_permitido(h) then raise exception 'Esta conversación no está disponible para tu sesión' using errcode='42501';end if;
  select * into c from equipo_conversaciones where id=h for update;
  if p_accion='leer' then
   update equipo_conversaciones set iniciador_leido_en=case when iniciador_id=u.id then clock_timestamp() else iniciador_leido_en end,destinatario_leido_en=case when destinatario_id=u.id then clock_timestamp() else destinatario_leido_en end where id=h;
   return jsonb_build_object('ok',true,'id',h);
  end if;
  texto:=trim(p_datos->>'contenido');
  if texto is null or length(texto) not between 1 and 3000 then raise exception 'Escribe una respuesta de hasta 3000 caracteres' using errcode='23514';end if;
  select * into m from equipo_mensajes where id=p_clave;
  if found then
   if m.autor<>u.id or m.conversacion_id<>h or m.contenido<>texto then raise exception 'La respuesta cambió; vuelve a abrir el mensaje' using errcode='40001';end if;
   return jsonb_build_object('ok',true,'id',h);
  end if;
 else raise exception 'Acción de comunicación inválida' using errcode='23514';end if;
 insert into equipo_mensajes(id,conversacion_id,autor,contenido) values(p_clave,h,u.id,texto);
 update equipo_conversaciones set actualizado_en=clock_timestamp(),iniciador_leido_en=case when iniciador_id=u.id then clock_timestamp() else iniciador_leido_en end,destinatario_leido_en=case when destinatario_id=u.id then clock_timestamp() else destinatario_leido_en end where id=h;
 destino:=case when c.iniciador_id=u.id then c.destinatario_id else c.iniciador_id end;
 insert into notificaciones(usuario_id,tipo,titulo,mensaje,clave) values(destino,'mensaje_equipo',case when c.urgente then 'Mensaje prioritario del equipo' else 'Nuevo mensaje del equipo' end,'Tienes una comunicación de '||u.nombre_completo||'. Abre Equipo para revisarla y responder.','equipo:'||p_clave) on conflict(usuario_id,clave) do nothing;
 insert into auditoria_clinica(autor,autor_nombre,tabla,registro_id,accion,nuevo) values(auth.uid(),u.nombre_completo,'equipo_mensajes',p_clave::text,'MENSAJE_EQUIPO',jsonb_build_object('conversacion',h,'destinatario',destino,'ambito',c.ambito));
 return jsonb_build_object('ok',true,'id',h);
end $$;
revoke all on function clinica_equipo_operar(text,jsonb,uuid) from public,anon;
grant execute on function clinica_equipo_operar(text,jsonb,uuid) to authenticated;

create function clinica_equipo_panel() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u usuarios;
begin
 perform clinica_requerir_sesion();select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if u.id is null or u.rol not in('admin','medico','enfermero','recepcionista') then raise exception 'No tienes acceso al equipo' using errcode='42501';end if;
 return jsonb_build_object('usuarioId',u.id,'destinatarios',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'nombre',v.nombre_completo,'rol',v.rol) order by v.rol,v.nombre_completo),'[]') from usuarios v where v.id<>u.id and v.esta_activo and v.rol in('admin','medico','enfermero','recepcionista')),
 'pacientes',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',v.nombre_completo) order by v.nombre_completo),'[]') from perfiles_pacientes p join usuarios v on v.id=p.usuario_id where p.esta_activo and v.esta_activo and clinica_equipo_acceso_paciente(u.id,p.id)),
 'conversaciones',(select coalesce(jsonb_agg(q order by q.actualizado_en desc),'[]') from(select c.*,i.nombre_completo iniciador,d.nombre_completo destinatario,i.rol rol_iniciador,d.rol rol_destinatario,pv.nombre_completo paciente,
 (select count(*) from equipo_mensajes m where m.conversacion_id=c.id and m.autor<>u.id and m.creado_en>coalesce(case when c.iniciador_id=u.id then c.iniciador_leido_en else c.destinatario_leido_en end,'epoch')) sin_leer,
 (select coalesce(jsonb_agg(mm order by mm.creado_en),'[]') from(select m.id,m.autor,v.nombre_completo responsable,m.contenido,m.creado_en from equipo_mensajes m join usuarios v on v.id=m.autor where m.conversacion_id=c.id order by m.creado_en desc limit 100) mm) mensajes
 from equipo_conversaciones c join usuarios i on i.id=c.iniciador_id join usuarios d on d.id=c.destinatario_id left join perfiles_pacientes p on p.id=c.paciente_id left join usuarios pv on pv.id=p.usuario_id
 where clinica_equipo_hilo_permitido(c.id) order by c.actualizado_en desc limit 100) q));
end $$;
revoke all on function clinica_equipo_panel() from public,anon;
grant execute on function clinica_equipo_panel() to authenticated;

-- Conserva las restricciones de acceso a pacientes; añade únicamente datos agregados del centro.
alter function clinica_enfermeria_panel() rename to clinica_enfermeria_panel_v44;
revoke all on function clinica_enfermeria_panel_v44() from public,anon,authenticated,service_role;
create function clinica_enfermeria_panel() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r jsonb;uid bigint;rol text;centros bigint[];mapa jsonb;
begin
 r:=clinica_enfermeria_panel_v44();select id,u.rol::text into uid,rol from usuarios u where auth_user_id=auth.uid() and esta_activo;
 select array_agg(distinct id) into centros from clinicas cl where cl.esta_activo and (rol='admin' or exists(select 1 from perfiles_enfermeros e where e.usuario_id=uid and e.clinica_id=cl.id and e.esta_activo) or exists(select 1 from perfiles_medicos m where m.usuario_id=uid and m.clinica_id=cl.id and m.esta_activo));
 select coalesce(jsonb_agg(q order by q.habitacion,q.numero),'[]') into mapa from(select c.id,c.numero,h.numero habitacion,h.tipo,h.clinica_id,c.esta_ocupada,c.habilitada,h.activa habitacion_activa from camas c join habitaciones h on h.id=c.habitacion_id where h.clinica_id=any(centros)) q;
 return r||jsonb_build_object('mapaCamas',mapa,'resumenCamas',jsonb_build_object('total',jsonb_array_length(mapa),'ocupadas',(select count(*) from jsonb_array_elements(mapa) c where (c->>'esta_ocupada')::boolean),'libres',(select count(*) from jsonb_array_elements(mapa) c where not(c->>'esta_ocupada')::boolean and(c->>'habilitada')::boolean and(c->>'habitacion_activa')::boolean)));
end $$;
revoke all on function clinica_enfermeria_panel() from public,anon;
grant execute on function clinica_enfermeria_panel() to authenticated;
create or replace function clinica_version() returns integer language sql stable as $$select 45$$;
notify pgrst,'reload schema';
commit;
