begin;
-- Recibos privados para que una respuesta perdida no duplique una admisión.
create table enfermeria_ingresos_recibos(
 autor bigint not null references usuarios(id), clave uuid not null, solicitud jsonb not null,
 respuesta jsonb not null, creado_en timestamptz not null default clock_timestamp(), primary key(autor,clave)
);
alter table enfermeria_ingresos_recibos enable row level security;
revoke all on enfermeria_ingresos_recibos from public,anon,authenticated;

create function clinica_enfermeria_ingresos_panel(p_busqueda text default '') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare e perfiles_enfermeros; q text:=trim(coalesce(p_busqueda,''));
begin
 perform clinica_requerir_sesion();
 if clinica_rol() is distinct from 'enfermero' then raise exception 'El ingreso urgente se registra desde enfermería' using errcode='42501'; end if;
 select pe.* into e from perfiles_enfermeros pe join usuarios u on u.id=pe.usuario_id join clinicas cl on cl.id=pe.clinica_id
 where u.auth_user_id=auth.uid() and u.esta_activo and pe.esta_activo and cl.esta_activo order by pe.id limit 1;
 if e.id is null then raise exception 'Tu perfil de enfermería requiere una clínica activa' using errcode='42501'; end if;
 if length(q)>120 then raise exception 'La búsqueda admite hasta 120 caracteres'; end if;
 return jsonb_build_object('ingresos','[]'::jsonb,
 'pacientes',coalesce((select jsonb_agg(p) from (
   select pp.id,u.nombre_completo||' · PAC-'||lpad(pp.id::text,greatest(5,length(pp.id::text)),'0') nombre,false "ingresoActivo"
   from perfiles_pacientes pp join usuarios u on u.id=pp.usuario_id
   where length(q)>=3 and pp.esta_activo and u.esta_activo and u.rol='paciente'
    and (position(lower(q) in lower(u.nombre_completo))>0 or upper(q)='PAC-'||lpad(pp.id::text,greatest(5,length(pp.id::text)),'0'))
    and not exists(select 1 from internaciones i where i.paciente_id=pp.id and i.estado='activa')
   order by u.nombre_completo,pp.id limit 20
 ) p),'[]'::jsonb),
 'medicos',coalesce((select jsonb_agg(jsonb_build_object('id',pm.id,'nombre',u.nombre_completo,'especialidad',pm.especialidad,'clinicaId',pm.clinica_id) order by u.nombre_completo)
 from perfiles_medicos pm join usuarios u on u.id=pm.usuario_id where pm.clinica_id=e.clinica_id and pm.esta_activo and u.esta_activo and u.rol='medico'),'[]'::jsonb),
 'camas',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'habitacionId',h.id,'clinicaId',h.clinica_id,'numero',clinica_catalogo_normalizar(c.numero,true),'habitacion',clinica_catalogo_normalizar(h.numero),'tipo',h.tipo,'ocupada',false,'habilitada',true,'paciente',null,'internacionId',null,'inconsistente',false) order by h.numero,c.numero)
 from camas c join habitaciones h on h.id=c.habitacion_id where h.clinica_id=e.clinica_id and h.activa and c.habilitada and not c.esta_ocupada
 and not exists(select 1 from internaciones i where i.cama_id=c.id and i.estado='activa')),'[]'::jsonb));
end $$;

create function clinica_enfermeria_ingreso_registrar(p_datos jsonb,p_clave uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare e perfiles_enfermeros; u usuarios; c camas; h habitaciones; m perfiles_medicos;
 p bigint; nuevo bigint; anterior enfermeria_ingresos_recibos; resultado jsonb; motivo text; observaciones text;
begin
 perform clinica_requerir_sesion();
 if clinica_rol() is distinct from 'enfermero' then raise exception 'El ingreso urgente se registra desde enfermería' using errcode='42501'; end if;
 select * into u from usuarios where auth_user_id=auth.uid() and esta_activo;
 select pe.* into e from perfiles_enfermeros pe join clinicas cl on cl.id=pe.clinica_id where pe.usuario_id=u.id and pe.esta_activo and cl.esta_activo order by pe.id limit 1;
 if e.id is null then raise exception 'Tu perfil de enfermería requiere una clínica activa' using errcode='42501'; end if;
 if p_clave is null or jsonb_typeof(p_datos) is distinct from 'object' or length(p_datos::text)>18000
 or p_datos->'confirmado' is distinct from 'true'::jsonb then raise exception 'Revisa y confirma los datos del ingreso' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(37202,0);
 select * into anterior from enfermeria_ingresos_recibos where autor=u.id and clave=p_clave;
 if found then
  if anterior.solicitud is distinct from p_datos then raise exception 'La solicitud ya fue utilizada con otros datos' using errcode='40001'; end if;
  return anterior.respuesta;
 end if;
 motivo:=trim(p_datos->>'motivo'); observaciones:=trim(coalesce(p_datos->>'observaciones',''));
 if jsonb_typeof(p_datos->'motivo') is distinct from 'string' or length(coalesce(motivo,'')) not between 1 and 8000
 or jsonb_typeof(p_datos->'observaciones') is distinct from 'string' or length(observaciones)>8000
 or coalesce(p_datos->>'pacienteId','')!~'^[1-9][0-9]{0,15}$' or coalesce(p_datos->>'medicoId','')!~'^[1-9][0-9]{0,15}$' or coalesce(p_datos->>'camaId','')!~'^[1-9][0-9]{0,15}$'
 then raise exception 'Selecciona paciente, médico y cama, e indica el motivo' using errcode='23514'; end if;
 p:=(p_datos->>'pacienteId')::bigint;
 if not exists(select 1 from perfiles_pacientes pp join usuarios pu on pu.id=pp.usuario_id where pp.id=p and pp.esta_activo and pu.esta_activo and pu.rol='paciente') then raise exception 'Selecciona un paciente registrado y activo'; end if;
 select pm.* into m from perfiles_medicos pm join usuarios um on um.id=pm.usuario_id where pm.id=(p_datos->>'medicoId')::bigint and pm.esta_activo and um.esta_activo and um.rol='medico';
 select * into c from camas where id=(p_datos->>'camaId')::bigint for update;
 select * into h from habitaciones where id=c.habitacion_id;
 if m.id is null or c.id is null or h.id is null or m.clinica_id<>e.clinica_id or h.clinica_id<>e.clinica_id then raise exception 'El médico y la cama deben pertenecer a tu clínica' using errcode='42501'; end if;
 if not c.habilitada or not h.activa then raise exception 'La cama o habitación quedó fuera de servicio; selecciona otra' using errcode='PT409'; end if;
 if c.esta_ocupada or exists(select 1 from internaciones i where i.estado='activa' and (i.cama_id=c.id or i.paciente_id=p)) then raise exception 'El paciente o la cama ya tienen una hospitalización activa; revisa las opciones' using errcode='PT409'; end if;
 insert into internaciones(paciente_id,medico_responsable_id,clinica_id,habitacion_id,cama_id,motivo_ingreso,diagnostico_ingreso)
 values(p,m.id,e.clinica_id,h.id,c.id,motivo,'') returning id into nuevo;
 update camas set esta_ocupada=true where id=c.id;
 insert into episodios_medicos(internacion_id,medico_id,tipo_episodio,descripcion,otros_signos)
 values(nuevo,m.id,'Ingreso urgente','Motivo: '||motivo||case when observaciones<>'' then E'\nObservaciones de enfermería: '||observaciones else '' end,
 jsonb_build_object('auditoria',jsonb_build_object('usuarioId',u.id,'nombre',u.nombre_completo,'rol','enfermero'),'diagnosticoPendiente',true));
 -- El trigger de internaciones avisa al médico. Recepción recibe solo coordinación operativa.
 insert into notificaciones(usuario_id,tipo,titulo,mensaje,clave)
 select ur.id,'ingreso_urgente','Ingreso urgente registrado','Enfermería registró un ingreso urgente. Coordina con el médico responsable y administración el seguimiento del ingreso # '||nuevo||'.','ingreso_urgente:'||nuevo
 from usuarios ur where ur.esta_activo and ur.rol='recepcionista';
 resultado:=jsonb_build_object('ok',true,'id',nuevo);
 insert into enfermeria_ingresos_recibos(autor,clave,solicitud,respuesta) values(u.id,p_clave,p_datos,resultado);
 return resultado;
end $$;
revoke all on function clinica_enfermeria_ingresos_panel(text),clinica_enfermeria_ingreso_registrar(jsonb,uuid) from public,anon,service_role;
grant execute on function clinica_enfermeria_ingresos_panel(text),clinica_enfermeria_ingreso_registrar(jsonb,uuid) to authenticated;
create or replace function clinica_version() returns integer language sql stable as $$select 47$$;
notify pgrst,'reload schema';
commit;
