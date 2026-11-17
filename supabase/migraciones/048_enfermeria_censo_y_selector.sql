begin;
-- El selector abre con pacientes registrados disponibles. Solo devuelve identificación mínima.
create or replace function clinica_enfermeria_ingresos_panel(p_busqueda text default '') returns jsonb
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
   where pp.esta_activo and u.esta_activo and u.rol='paciente'
    and (q='' or position(lower(q) in lower(u.nombre_completo))>0 or upper(q)='PAC-'||lpad(pp.id::text,greatest(5,length(pp.id::text)),'0'))
    and not exists(select 1 from internaciones i where i.paciente_id=pp.id and i.estado='activa')
   order by u.nombre_completo,pp.id limit 1000
 ) p),'[]'::jsonb),
 'medicos',coalesce((select jsonb_agg(jsonb_build_object('id',pm.id,'nombre',u.nombre_completo,'especialidad',pm.especialidad,'clinicaId',pm.clinica_id) order by u.nombre_completo)
 from perfiles_medicos pm join usuarios u on u.id=pm.usuario_id where pm.clinica_id=e.clinica_id and pm.esta_activo and u.esta_activo and u.rol='medico'),'[]'::jsonb),
 'camas',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'habitacionId',h.id,'clinicaId',h.clinica_id,'numero',clinica_catalogo_normalizar(c.numero,true),'habitacion',clinica_catalogo_normalizar(h.numero),'tipo',h.tipo,'ocupada',false,'habilitada',true,'paciente',null,'internacionId',null,'inconsistente',false) order by h.numero,c.numero)
 from camas c join habitaciones h on h.id=c.habitacion_id where h.clinica_id=e.clinica_id and h.activa and c.habilitada and not c.esta_ocupada
 and not exists(select 1 from internaciones i where i.cama_id=c.id and i.estado='activa')),'[]'::jsonb));
end $$;

-- Censo operativo de la clínica: paciente, médico y ubicación, sin diagnósticos ni historial.
alter function clinica_enfermeria_panel() rename to clinica_enfermeria_panel_v47;
revoke all on function clinica_enfermeria_panel_v47() from public,anon,authenticated,service_role;
create function clinica_enfermeria_panel() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r jsonb; centro bigint; mapa jsonb;
begin
 r:=clinica_enfermeria_panel_v47();
 if clinica_rol() is distinct from 'enfermero' then return r; end if;
 select e.clinica_id into centro from perfiles_enfermeros e join usuarios u on u.id=e.usuario_id join clinicas cl on cl.id=e.clinica_id
 where u.auth_user_id=auth.uid() and u.esta_activo and e.esta_activo and cl.esta_activo order by e.id limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'numero',clinica_catalogo_normalizar(c.numero,true),'habitacion',clinica_catalogo_normalizar(h.numero),
 'tipo',h.tipo,'clinica_id',h.clinica_id,'esta_ocupada',c.esta_ocupada or i.id is not null,'habilitada',c.habilitada,'habitacion_activa',h.activa,
 'ocupante',case when i.id is not null then jsonb_build_object('id',i.id,'pacienteId',i.paciente_id,'paciente',pu.nombre_completo,
 'medicoId',m.id,'medico',mu.nombre_completo,'fechaIngreso',i.fecha_ingreso,'asignado',clinica_paciente(i.paciente_id)) else null end)
 order by h.numero,c.numero),'[]') into mapa
 from camas c join habitaciones h on h.id=c.habitacion_id
 left join internaciones i on i.cama_id=c.id and i.estado='activa'
 left join perfiles_pacientes p on p.id=i.paciente_id left join usuarios pu on pu.id=p.usuario_id
 left join perfiles_medicos m on m.id=i.medico_responsable_id left join usuarios mu on mu.id=m.usuario_id
 where h.clinica_id=centro;
 return r||jsonb_build_object('mapaCamas',mapa,'resumenCamas',jsonb_build_object('total',jsonb_array_length(mapa),
 'ocupadas',(select count(*) from jsonb_array_elements(mapa) c where (c->>'esta_ocupada')::boolean),
 'libres',(select count(*) from jsonb_array_elements(mapa) c where not(c->>'esta_ocupada')::boolean and(c->>'habilitada')::boolean and(c->>'habitacion_activa')::boolean),
 'fueraServicio',(select count(*) from jsonb_array_elements(mapa) c where not(c->>'habilitada')::boolean or not(c->>'habitacion_activa')::boolean)));
end $$;
revoke all on function clinica_enfermeria_panel() from public,anon,service_role;
grant execute on function clinica_enfermeria_panel() to authenticated;
create or replace function clinica_version() returns integer language sql stable as $$select 48$$;
notify pgrst,'reload schema';
commit;

