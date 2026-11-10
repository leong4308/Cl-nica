begin;
create extension if not exists btree_gist;
-- Si existen cruces históricos, la migración falla y revierte sin borrar datos.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='clinica_citas_medico_sin_cruces') then
  alter table citas add constraint clinica_citas_medico_sin_cruces exclude using gist(medico_id with =,tstzrange(inicio,fin,'[)') with &&) where(estado in ('pendiente','confirmada','atendida'));
 end if;
 if not exists(select 1 from pg_constraint where conname='clinica_citas_paciente_sin_cruces') then
  alter table citas add constraint clinica_citas_paciente_sin_cruces exclude using gist(paciente_id with =,tstzrange(inicio,fin,'[)') with &&) where(estado in ('pendiente','confirmada','atendida'));
 end if;
end $$;
create unique index if not exists clinica_cama_ingreso_activo on internaciones(cama_id) where estado='activa';
create unique index if not exists clinica_paciente_ingreso_activo on internaciones(paciente_id) where estado='activa';

create or replace function public.clinica_validar_cita() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare m perfiles_medicos; config configuracion_agenda; f date; h time; b jsonb; d jsonb; cabe boolean:=false;
begin
 perform pg_advisory_xact_lock(37201,0);
 if new.estado not in ('pendiente','confirmada','atendida') then return new; end if;
 select * into m from perfiles_medicos where id=new.medico_id and esta_activo;
 if not found or not exists(select 1 from usuarios where id=m.usuario_id and esta_activo and rol='medico') then raise exception 'El médico no está activo'; end if;
 if new.clinica_id<>m.clinica_id or new.fin<=new.inicio then raise exception 'Clínica o intervalo inválido'; end if;
 if tg_op='UPDATE' and new.inicio=old.inicio and new.fin=old.fin and new.medico_id=old.medico_id and old.estado in ('pendiente','confirmada','atendida') then return new; end if;
 if tg_op='INSERT' or new.inicio<>old.inicio or new.fin<>old.fin or new.medico_id<>old.medico_id then
  if new.inicio<=clock_timestamp() or new.fin-new.inicio<>make_interval(mins=>m.duracion_consulta) then raise exception 'Revisa la fecha y la duración de consulta'; end if;
 end if;
 f:=(new.inicio at time zone 'America/Mexico_City')::date; h:=(new.inicio at time zone 'America/Mexico_City')::time;
 if new.fin>((f+1)::timestamp at time zone 'America/Mexico_City') then raise exception 'La cita debe terminar dentro del mismo día'; end if;
 select * into config from configuracion_agenda where medico_id=new.medico_id;
 if found then
  for d in select * from jsonb_array_elements(config.descansos) loop
   if tstzrange(new.inicio,new.fin,'[)') && tstzrange(((d->>'fecha')::date+(d->>'inicio')::time) at time zone 'America/Mexico_City',((d->>'fecha')::date+(d->>'fin')::time) at time zone 'America/Mexico_City','[)') then raise exception 'El médico tiene un descanso asignado' using errcode='23P01'; end if;
  end loop;
  if jsonb_array_length(config.bloques)>0 then
   for b in select * from jsonb_array_elements(config.bloques) loop
    if (b->>'dia')::integer=extract(dow from f)::integer and h>=(b->>'inicio')::time and (new.fin at time zone 'America/Mexico_City')<=f+(b->>'fin')::time and mod((extract(epoch from (h-(b->>'inicio')::time))/60)::integer,coalesce((b->>'paso')::integer,m.duracion_consulta))=0 then cabe:=true; end if;
   end loop;
   if not cabe then raise exception 'El intervalo no corresponde al horario publicado'; end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists clinica_cita_validar on citas;
create trigger clinica_cita_validar before insert or update on citas for each row execute function clinica_validar_cita();

create or replace function public.clinica_vincular_atencion() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_medico bigint;
begin
 if tg_table_name='citas' then
  if new.estado not in ('pendiente','confirmada','atendida') then return new; end if;
  if tg_op='UPDATE' and new.medico_id=old.medico_id and new.paciente_id=old.paciente_id then return new; end if;
  v_medico:=new.medico_id;
 else v_medico:=new.medico_responsable_id; end if;
 insert into paciente_medicos(paciente_id,medico_id,motivo) values(new.paciente_id,v_medico,'Vínculo por atención registrada') on conflict(paciente_id,medico_id) do update set activo=true,actualizado_en=clock_timestamp() where not paciente_medicos.activo;
 return new;
end $$;
drop trigger if exists clinica_cita_vinculo on citas;
create trigger clinica_cita_vinculo after insert or update on citas for each row execute function clinica_vincular_atencion();
drop trigger if exists clinica_ingreso_vinculo on internaciones;
create trigger clinica_ingreso_vinculo after insert or update of medico_responsable_id on internaciones for each row execute function clinica_vincular_atencion();

create or replace function public.clinica_crear_cita(p_paciente bigint,p_medico bigint,p_inicio timestamptz,p_motivo text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m perfiles_medicos; r citas;
begin
 if clinica_rol() not in ('admin','recepcionista','medico') or clinica_rol() is null then raise exception 'No tienes permiso para agendar' using errcode='42501'; end if;
 if clinica_rol()='medico' and (p_medico<>clinica_medico() or not clinica_paciente(p_paciente)) then raise exception 'Solo puedes agendar con tus pacientes' using errcode='42501'; end if;
 if length(trim(coalesce(p_motivo,''))) not between 1 and 2000 then raise exception 'Escribe el motivo de consulta'; end if;
 if not exists(select 1 from perfiles_pacientes p join usuarios u on u.id=p.usuario_id where p.id=p_paciente and p.esta_activo and u.esta_activo) then raise exception 'Selecciona un paciente activo'; end if;
 select * into m from perfiles_medicos where id=p_medico and esta_activo;
 if not found or m.duracion_consulta not between 5 and 240 then raise exception 'Revisa el perfil médico'; end if;
 insert into citas(paciente_id,medico_id,clinica_id,inicio,fin,motivo) values(p_paciente,p_medico,m.clinica_id,p_inicio,p_inicio+make_interval(mins=>m.duracion_consulta),trim(p_motivo)) returning * into r;
 return jsonb_build_object('id',r.id,'inicio',r.inicio,'fin',r.fin);
end $$;

create or replace function public.clinica_guardar_agenda(p_medico bigint,p_bloques jsonb,p_descansos jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d jsonb; b jsonb; anterior jsonb; dia integer; inicio time; fin time;
begin
 if clinica_rol() is distinct from 'admin' then raise exception 'Solo administración configura horarios' using errcode='42501'; end if;
 if jsonb_typeof(p_bloques)<>'array' or jsonb_array_length(p_bloques)>42 or jsonb_typeof(p_descansos)<>'array' or jsonb_array_length(p_descansos)>180 then raise exception 'Revisa el horario'; end if;
 perform 1 from perfiles_medicos where id=p_medico and esta_activo; if not found then raise exception 'Médico no disponible'; end if;
 for b in select * from jsonb_array_elements(p_bloques) order by (value->>'dia')::integer,value->>'inicio' loop
  dia:=(b->>'dia')::integer; inicio:=(b->>'inicio')::time; fin:=(b->>'fin')::time;
  if dia not between 0 and 6 or inicio>=fin or coalesce((b->>'paso')::integer,20) not between 5 and 240 then raise exception 'Bloque de horario inválido'; end if;
  if anterior is not null and anterior->>'dia'=b->>'dia' and (anterior->>'fin')::time>inicio then raise exception 'Hay bloques superpuestos'; end if;
  anterior:=b;
 end loop;
 perform pg_advisory_xact_lock(37201,0);
 anterior:=null;
 for d in select * from jsonb_array_elements(p_descansos) order by value->>'fecha',value->>'inicio' loop
  if (d->>'inicio')::time >= (d->>'fin')::time or length(coalesce(d->>'motivo',''))>200 then raise exception 'Descanso inválido'; end if;
  if anterior is not null and anterior->>'fecha'=d->>'fecha' and (anterior->>'fin')::time>(d->>'inicio')::time then raise exception 'Hay descansos superpuestos'; end if;
  if exists(select 1 from citas c where c.medico_id=p_medico and estado in ('pendiente','confirmada','atendida') and tstzrange(c.inicio,c.fin,'[)') && tstzrange(((d->>'fecha')::date+(d->>'inicio')::time) at time zone 'America/Mexico_City',((d->>'fecha')::date+(d->>'fin')::time) at time zone 'America/Mexico_City','[)')) then raise exception 'El descanso coincide con una cita. Reagéndala primero' using errcode='23P01'; end if;
  anterior:=d;
 end loop;
 insert into configuracion_agenda(medico_id,bloques,descansos) values(p_medico,p_bloques,p_descansos) on conflict(medico_id) do update set bloques=excluded.bloques,descansos=excluded.descansos,actualizado_en=clock_timestamp();
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.clinica_hospital(p_id bigint,p_datos jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r internaciones; m perfiles_medicos; c camas; hab habitaciones; nuevo_id bigint; v_cama bigint; v_medico bigint; v_paciente bigint;
 v_accion text:=coalesce(p_datos->>'accion','crear'); v_tipo text; v_nota text; v_actor usuarios; corregidas integer;
begin
 if clinica_rol() not in ('admin','medico','enfermero') or clinica_rol() is null then raise exception 'No tienes permiso para gestionar hospitalizaciones' using errcode='42501'; end if;
 select * into v_actor from usuarios where auth_user_id=auth.uid() and esta_activo;
 perform pg_advisory_xact_lock(37202,0);
 if v_accion='sincronizar' then
  if clinica_rol()<>'admin' then raise exception 'Solo administración sincroniza camas' using errcode='42501'; end if;
  update camas b set esta_ocupada=exists(select 1 from internaciones i where i.cama_id=b.id and i.estado='activa') where b.esta_ocupada is distinct from exists(select 1 from internaciones i where i.cama_id=b.id and i.estado='activa');
  get diagnostics corregidas=row_count; return jsonb_build_object('ok',true,'corregidas',corregidas);
 end if;
 if p_id is not null then
  select * into r from internaciones where id=p_id for update;
  if not found or not clinica_paciente(r.paciente_id) then raise exception 'Ingreso no encontrado o sin acceso' using errcode='42501'; end if;
  if (p_datos->>'version')::timestamptz is distinct from r.actualizado_en then raise exception 'El ingreso cambió. Vuelve a cargarlo' using errcode='40001'; end if;
  v_paciente:=r.paciente_id;
 else v_paciente:=(p_datos->>'pacienteId')::bigint; end if;
 if not clinica_paciente(v_paciente) then raise exception 'Paciente sin acceso' using errcode='42501'; end if;
 if v_accion='alta' then
  if p_id is null or r.estado<>'activa' or (p_datos->>'confirmado')::boolean is distinct from true or length(trim(coalesce(p_datos->>'notaAlta',''))) not between 1 and 8000 then raise exception 'Confirma el alta y registra la nota de egreso'; end if;
  update internaciones set estado='alta',fecha_alta=clock_timestamp(),actualizado_en=clock_timestamp() where id=p_id;
  update camas set esta_ocupada=false where id=r.cama_id;
  v_tipo:='Alta'; v_nota:=p_datos->>'notaAlta'; v_medico:=r.medico_responsable_id; nuevo_id:=p_id;
 elsif v_accion in ('crear','editar') then
  if (p_id is null)<>(v_accion='crear') then raise exception 'Acción de hospitalización inválida'; end if;
  v_cama:=(p_datos->>'camaId')::bigint; v_medico:=(p_datos->>'medicoId')::bigint;
  select m1.* into m from perfiles_medicos m1 join usuarios u on u.id=m1.usuario_id where m1.id=v_medico and m1.esta_activo and u.esta_activo and u.rol='medico'; if not found then raise exception 'Médico no disponible'; end if;
  select * into c from camas where id=v_cama for update; if not found then raise exception 'Cama no encontrada'; end if;
  select * into hab from habitaciones where id=c.habitacion_id;
  if hab.clinica_id<>m.clinica_id or (p_id is not null and hab.clinica_id<>r.clinica_id) then raise exception 'El médico y la cama deben pertenecer a la clínica del ingreso'; end if;
  if length(trim(coalesce(p_datos->>'motivo',''))) not between 1 and 8000 or length(coalesce(p_datos->>'diagnostico',''))>8000 or length(coalesce(p_datos->>'notaCambio',''))>8000 then raise exception 'Revisa el motivo y las notas'; end if;
  if p_id is null then
   if not exists(select 1 from perfiles_pacientes p join usuarios u on u.id=p.usuario_id where p.id=v_paciente and p.esta_activo and u.esta_activo) then raise exception 'Selecciona un paciente activo'; end if;
   if c.esta_ocupada or exists(select 1 from internaciones where estado='activa' and (cama_id=v_cama or paciente_id=v_paciente)) then raise exception 'El paciente o la cama ya tienen un ingreso activo' using errcode='23505'; end if;
   insert into internaciones(paciente_id,medico_responsable_id,clinica_id,habitacion_id,cama_id,motivo_ingreso,diagnostico_ingreso) values(v_paciente,v_medico,hab.clinica_id,c.habitacion_id,v_cama,p_datos->>'motivo',p_datos->>'diagnostico') returning id into nuevo_id;
   update camas set esta_ocupada=true where id=v_cama;
   v_tipo:='Ingreso'; v_nota:='Motivo: '||(p_datos->>'motivo');
  else
   if r.estado<>'activa' and (v_cama<>r.cama_id or length(trim(coalesce(p_datos->>'notaCambio','')))=0) then raise exception 'Un ingreso cerrado conserva la cama y requiere motivo de corrección'; end if;
   if r.estado='activa' and v_cama<>r.cama_id and (c.esta_ocupada or exists(select 1 from internaciones where cama_id=v_cama and estado='activa')) then raise exception 'La cama ya está ocupada' using errcode='23505'; end if;
   update internaciones set medico_responsable_id=v_medico,cama_id=v_cama,habitacion_id=c.habitacion_id,motivo_ingreso=p_datos->>'motivo',diagnostico_ingreso=p_datos->>'diagnostico',actualizado_en=clock_timestamp() where id=p_id;
   if r.estado='activa' then update camas set esta_ocupada=(id=v_cama) where id in (r.cama_id,v_cama); end if;
   nuevo_id:=p_id; v_tipo:=case when r.estado<>'activa' then 'Corrección de registro' when v_cama<>r.cama_id then 'Traslado de cama' else 'Actualización' end;
   v_nota:=coalesce(nullif(p_datos->>'notaCambio',''),'Actualización de datos del ingreso.');
  end if;
 else raise exception 'Acción de hospitalización inválida'; end if;
 insert into episodios_medicos(internacion_id,medico_id,tipo_episodio,descripcion,otros_signos) values(nuevo_id,v_medico,v_tipo,v_nota,jsonb_build_object('auditoria',jsonb_build_object('usuarioId',v_actor.id,'nombre',v_actor.nombre_completo)));
 return jsonb_build_object('id',nuevo_id);
end $$;
create or replace function public.clinica_version() returns integer language sql stable as $$select 19$$;
do $$ declare r record; begin
 for r in select oid::regprocedure as firma from pg_proc where pronamespace='public'::regnamespace and proname like 'clinica_%' loop
  execute format('revoke all on function %s from public,anon',r.firma);
  execute format('grant execute on function %s to authenticated,service_role',r.firma);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
