begin;
alter table habitaciones add column activa boolean not null default true,add column motivo_baja text,add column revision bigint not null default 1;
alter table camas add column habilitada boolean not null default true,add column motivo_baja text,add column revision bigint not null default 1;
alter table internaciones add column ubicacion_registrada jsonb;
do $secuencias$ declare t text;s text;ultimo bigint;maximo bigint;begin
 foreach t in array array['habitaciones','camas'] loop
  s:=pg_get_serial_sequence('public.'||t,'id');execute format('select last_value from %s',s) into ultimo;execute format('select coalesce(max(id),0) from public.%I',t) into maximo;
  perform setval(s::regclass,greatest(ultimo,maximo,1),true);
 end loop;
end $secuencias$;
-- Conserva la ubicación que muestran los registros actuales antes de permitir renombrar recursos.
update internaciones i set ubicacion_registrada=jsonb_build_object('habitacion',h.numero,'cama',c.numero,'tipo',h.tipo) from habitaciones h,camas c where h.id=i.habitacion_id and c.id=i.cama_id;
revoke insert,update,delete on habitaciones,camas from authenticated;
create table catalogo_camas_operaciones(autor bigint not null references usuarios(id),clave uuid not null,solicitud jsonb not null,respuesta jsonb not null,creado_en timestamptz not null default clock_timestamp(),primary key(autor,clave));
alter table catalogo_camas_operaciones enable row level security;

create function public.clinica_catalogo_normalizar(p_numero text,p_cama boolean default false) returns text language sql immutable as $$
 select trim(regexp_replace(trim(coalesce(p_numero,'')),case when p_cama then '^cama[[:space:]]*' else '^(habitación|habitacion|hab\.?)[[:space:]]+' end,'','i'))
$$;
revoke all on function clinica_catalogo_normalizar(text,boolean) from public,anon,authenticated;
create function public.clinica_infraestructura_proteger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare capacidad integer; habilitadas integer;
begin
 perform pg_advisory_xact_lock(37202,0);
 if tg_table_name='camas' then
  if tg_op='UPDATE' then
   if new.habitacion_id<>old.habitacion_id then raise exception 'La cama conserva su habitación; registra otra ubicación para una cama nueva'; end if;
   if (new.numero is distinct from old.numero or new.habilitada is distinct from old.habilitada) and (old.esta_ocupada or exists(select 1 from internaciones where cama_id=old.id and estado='activa')) then raise exception 'No se puede renombrar ni deshabilitar una cama ocupada' using errcode='23514'; end if;
   new.revision:=old.revision+1;
  end if;
  if new.habilitada and (tg_op='INSERT' or not old.habilitada) then
   select h.capacidad into capacidad from habitaciones h join clinicas cl on cl.id=h.clinica_id where h.id=new.habitacion_id and h.activa and cl.esta_activo;
   if capacidad is null then raise exception 'Selecciona una habitación y clínica activas'; end if;
   select count(*) into habilitadas from camas where habitacion_id=new.habitacion_id and habilitada and id is distinct from new.id;
   if habilitadas>=capacidad then raise exception 'La habitación alcanzó su capacidad de camas habilitadas' using errcode='23514'; end if;
  end if;
 else
  if tg_op='UPDATE' then
   if new.clinica_id<>old.clinica_id then raise exception 'La habitación conserva su clínica de origen'; end if;
   if (new.numero is distinct from old.numero or new.tipo is distinct from old.tipo or not new.activa and old.activa) and exists(select 1 from camas c where c.habitacion_id=old.id and (c.esta_ocupada or exists(select 1 from internaciones i where i.cama_id=c.id and i.estado='activa'))) then raise exception 'La habitación tiene camas ocupadas. Espera al egreso o traslado antes de modificarla' using errcode='23514'; end if;
   if new.capacidad<(select count(*) from camas where habitacion_id=old.id and habilitada) then raise exception 'La capacidad no puede ser menor al número de camas habilitadas' using errcode='23514'; end if;
   new.revision:=old.revision+1;
  end if;
 end if;
 return new;
end $$;
create trigger infraestructura_cama_guardar before insert or update on camas for each row execute function clinica_infraestructura_proteger();
create trigger infraestructura_habitacion_guardar before insert or update on habitaciones for each row execute function clinica_infraestructura_proteger();
create trigger infraestructura_cama_auditoria after insert or update or delete on camas for each row execute function clinica_auditar();
create trigger infraestructura_habitacion_auditoria after insert or update or delete on habitaciones for each row execute function clinica_auditar();

create function public.clinica_ingreso_ubicacion() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare c camas; h habitaciones;
begin
 perform pg_advisory_xact_lock(37202,0);
 select * into c from camas where id=new.cama_id;
 select * into h from habitaciones where id=new.habitacion_id;
 if new.estado='activa' and (not c.habilitada or not h.activa or not exists(select 1 from clinicas where id=h.clinica_id and esta_activo)) then raise exception 'Esta cama o habitación está fuera de servicio. Actualiza las opciones de ingreso' using errcode='23514'; end if;
 if tg_op='INSERT' or new.cama_id<>old.cama_id or new.habitacion_id<>old.habitacion_id or old.ubicacion_registrada is null then
  new.ubicacion_registrada:=jsonb_build_object('habitacion',h.numero,'cama',c.numero,'tipo',h.tipo);
 else new.ubicacion_registrada:=old.ubicacion_registrada;
 end if;
 return new;
end $$;
create trigger infraestructura_ingreso_ubicacion before insert or update on internaciones for each row execute function clinica_ingreso_ubicacion();

create function public.clinica_catalogo_camas() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 perform clinica_requerir_sesion();
 if clinica_rol() is distinct from 'admin' then raise exception 'Solo administración gestiona habitaciones y camas' using errcode='42501'; end if;
 return jsonb_build_object(
 'clinicas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'activa',esta_activo) order by nombre) from clinicas),'[]'::jsonb),
 'habitaciones',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'clinicaId',h.clinica_id,'numero',clinica_catalogo_normalizar(h.numero),'tipo',h.tipo,'capacidad',h.capacidad,'activa',h.activa,'motivo',h.motivo_baja,'habilitadas',(select count(*) from camas where habitacion_id=h.id and habilitada),'version',md5(to_jsonb(h)::text)) order by h.clinica_id,h.numero,h.id) from habitaciones h),'[]'::jsonb),
 'camas',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'habitacionId',c.habitacion_id,'numero',clinica_catalogo_normalizar(c.numero,true),'habilitada',c.habilitada,'motivo',c.motivo_baja,'ocupada',c.esta_ocupada or exists(select 1 from internaciones i where i.cama_id=c.id and i.estado='activa'),'version',md5(to_jsonb(c)::text)) order by c.habitacion_id,c.numero,c.id) from camas c),'[]'::jsonb));
end $$;
create function public.clinica_catalogo_camas_operar(p_accion text,p_datos jsonb,p_clave uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
<<operacion>>
declare u bigint; anterior catalogo_camas_operaciones; solicitud jsonb; respuesta jsonb; h habitaciones; c camas; numero text; tipo text; capacidad integer; motivo text; id_nuevo bigint;
begin
 perform clinica_requerir_sesion(); if clinica_rol() is distinct from 'admin' then raise exception 'Solo administración gestiona habitaciones y camas' using errcode='42501'; end if;
 select id into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 if p_accion is null or p_accion not in('crear_habitacion','editar_habitacion','estado_habitacion','crear_cama','editar_cama','estado_cama') or p_clave is null or jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>6000 then raise exception 'Solicitud de infraestructura inválida'; end if;
 perform pg_advisory_xact_lock(37202,0);
 solicitud:=jsonb_build_object('accion',p_accion,'datos',p_datos);
 select * into anterior from catalogo_camas_operaciones where autor=u and clave=p_clave;
 if found then if anterior.solicitud is distinct from solicitud then raise exception 'La solicitud ya fue utilizada para otros datos' using errcode='40001'; end if; return anterior.respuesta; end if;
 if p_accion='crear_habitacion' then
  if not exists(select 1 from clinicas where id=(p_datos->>'clinicaId')::bigint and esta_activo) then raise exception 'Selecciona una clínica activa'; end if;
 else
  if p_accion in('editar_cama','estado_cama') then
   select * into c from camas where id=(p_datos->>'id')::bigint for update;
   if c.id is null then raise exception 'Cama no encontrada'; end if;
   if md5(to_jsonb(c)::text) is distinct from p_datos->>'version' then raise exception 'La cama cambió. Actualiza el catálogo; tus datos no se guardaron' using errcode='40001'; end if;
   select * into h from habitaciones where id=c.habitacion_id for update;
  else
   select * into h from habitaciones where id=(case when p_accion='crear_cama' then p_datos->>'habitacionId' else p_datos->>'id' end)::bigint for update;
   if h.id is null then raise exception 'Habitación no encontrada'; end if;
   if p_accion<>'crear_cama' and md5(to_jsonb(h)::text) is distinct from p_datos->>'version' then raise exception 'La habitación cambió. Actualiza el catálogo; tus datos no se guardaron' using errcode='40001'; end if;
  end if;
 end if;
 if p_accion in('crear_habitacion','editar_habitacion') then
  numero:=clinica_catalogo_normalizar(p_datos->>'numero');tipo:=trim(p_datos->>'tipo');capacidad:=(p_datos->>'capacidad')::integer;
  if length(numero) not between 1 and 20 or length(coalesce(tipo,'')) not between 1 and 50 or capacidad is null or capacidad not between 1 and 100 then raise exception 'Indica número, tipo y capacidad de 1 a 100 camas'; end if;
  if exists(select 1 from habitaciones where clinica_id=coalesce(h.clinica_id,(p_datos->>'clinicaId')::bigint) and lower(clinica_catalogo_normalizar(habitaciones.numero))=lower(operacion.numero) and id is distinct from h.id) then raise exception 'Ya existe una habitación con ese número en la clínica' using errcode='23505'; end if;
  if p_accion='crear_habitacion' then insert into habitaciones(clinica_id,numero,tipo,capacidad) values((p_datos->>'clinicaId')::bigint,numero,tipo,capacidad) returning id into id_nuevo;
  else update habitaciones set numero=operacion.numero,tipo=operacion.tipo,capacidad=operacion.capacidad where id=h.id;id_nuevo:=h.id;end if;
 elsif p_accion in('crear_cama','editar_cama') then
  numero:=clinica_catalogo_normalizar(p_datos->>'numero',true);
  if length(numero) not between 1 and 20 then raise exception 'Indica un número o identificador de cama de hasta 20 caracteres'; end if;
  if exists(select 1 from camas where habitacion_id=h.id and lower(clinica_catalogo_normalizar(camas.numero,true))=lower(operacion.numero) and id is distinct from c.id) then raise exception 'Ya existe una cama con ese identificador en la habitación' using errcode='23505'; end if;
  if p_accion='crear_cama' then insert into camas(habitacion_id,numero) values(h.id,numero) returning id into id_nuevo;
  else update camas set numero=operacion.numero where id=c.id;id_nuevo:=c.id;end if;
 else
  if jsonb_typeof(p_datos->'habilitada') is distinct from 'boolean' then raise exception 'Indica si estará habilitada'; end if;
  motivo:=trim(coalesce(p_datos->>'motivo',''));
  if not (p_datos->>'habilitada')::boolean and length(motivo) not between 1 and 1000 then raise exception 'Escribe el motivo para dejar el recurso fuera de servicio'; end if;
  if p_accion='estado_cama' then update camas set habilitada=(p_datos->>'habilitada')::boolean,motivo_baja=case when (p_datos->>'habilitada')::boolean then null else motivo end where id=c.id;id_nuevo:=c.id;
  else
   if not (p_datos->>'habilitada')::boolean then
    if exists(select 1 from camas cc where cc.habitacion_id=h.id and (cc.esta_ocupada or exists(select 1 from internaciones ii where ii.cama_id=cc.id and ii.estado='activa'))) then raise exception 'La habitación tiene camas ocupadas' using errcode='23514'; end if;
    update camas set habilitada=false,motivo_baja=motivo where habitacion_id=h.id and habilitada;
   end if;
   update habitaciones set activa=(p_datos->>'habilitada')::boolean,motivo_baja=case when (p_datos->>'habilitada')::boolean then null else motivo end where id=h.id;id_nuevo:=h.id;
  end if;
 end if;
 respuesta:=jsonb_build_object('ok',true,'id',id_nuevo,'mensaje',case p_accion when 'crear_habitacion' then 'Habitación creada. Ahora puedes agregar sus camas.' when 'crear_cama' then 'Cama registrada y disponible para ingresos.' when 'estado_habitacion' then 'Estado de habitación actualizado. Sus camas se habilitan individualmente.' else 'Catálogo actualizado.' end);
 insert into catalogo_camas_operaciones(autor,clave,solicitud,respuesta) values(u,p_clave,solicitud,respuesta);
 return respuesta;
end $$;
revoke all on function clinica_infraestructura_proteger(),clinica_ingreso_ubicacion() from public,anon,authenticated,service_role;
revoke all on function clinica_catalogo_camas(),clinica_catalogo_camas_operar(text,jsonb,uuid) from public,anon;
grant execute on function clinica_catalogo_camas(),clinica_catalogo_camas_operar(text,jsonb,uuid) to authenticated;
create or replace function public.clinica_version() returns integer language sql stable as $$select 32$$;
notify pgrst,'reload schema';
commit;
