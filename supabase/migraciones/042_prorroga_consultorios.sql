begin;
-- Prórroga administrativa: conserva el turno original y crea su continuación.
-- Se ejecuta por clinica_operar_modulo con sesión, rol, versión e idempotencia.
alter function public.clinica_consultorios_mutar(text,jsonb) rename to clinica_consultorios_mutar_v41;
revoke all on function clinica_consultorios_mutar_v41(text,jsonb) from public,anon,authenticated,service_role;
create function public.clinica_consultorios_mutar(p_accion text,p_datos jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t consultorio_turnos;n consultorio_turnos;v_hasta date;v_desde date;hoy date;
begin
 if p_accion is distinct from 'prorrogar_turno' then return clinica_consultorios_mutar_v41(p_accion,p_datos);end if;
 perform clinica_requerir_sesion();
 if clinica_rol() is distinct from 'admin' then raise exception 'Solo administración prorroga consultorios' using errcode='42501';end if;
 if jsonb_typeof(p_datos) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_datos) k where k not in('id','version','hasta')) then raise exception 'La prórroga solo admite asignación, versión y fecha final';end if;
 select * into t from consultorio_turnos where id=(p_datos->>'id')::bigint for update;
 if t.id is null or md5(to_jsonb(t)::text) is distinct from p_datos->>'version' then raise exception 'La asignación cambió. Actualiza antes de prorrogarla' using errcode='PT409';end if;
 if not t.activo or not exists(select 1 from consultorios c join perfiles_medicos m on m.id=t.medico_id and m.clinica_id=c.clinica_id join usuarios u on u.id=m.usuario_id where c.id=t.consultorio_id and c.activo and m.esta_activo and u.esta_activo) then raise exception 'La asignación, el médico y el consultorio deben seguir activos en la misma clínica';end if;
 hoy:=(clock_timestamp() at time zone 'America/Mexico_City')::date;
 v_desde:=t.hasta+1;v_hasta:=(p_datos->>'hasta')::date;
 if v_hasta is null or t.hasta<hoy or v_desde>hoy+366 or v_hasta<v_desde or v_hasta-v_desde>366 then raise exception 'La continuación debe empezar dentro del próximo año, después del periodo actual, y durar como máximo 366 días';end if;
 -- La identidad del consultorio, médico, día y horas se obtiene del registro, nunca del cliente.
 insert into consultorio_turnos(consultorio_id,medico_id,desde,hasta,dia,inicio,fin)
 values(t.consultorio_id,t.medico_id,v_desde,v_hasta,t.dia,t.inicio,t.fin) returning * into n;
 -- Conserva las mismas restricciones y asignación de citas que el alta de un turno.
 update citas set consultorio_id=n.consultorio_id,consultorio_turno_id=n.id
 where medico_id=n.medico_id and estado in('pendiente','confirmada') and inicio>clock_timestamp()
 and consultorio_id is null and clinica_turno_consultorio(n.medico_id,inicio,fin)=n.id;
 return jsonb_build_object('ok',true,'id',n.id,'mensaje','Asignación prorrogada sin modificar su horario ni el periodo original.');
end $$;
revoke all on function clinica_consultorios_mutar(text,jsonb) from public,anon,authenticated,service_role;
-- La única entrada para el cliente sigue siendo clinica_operar_modulo, con su auditoría e idempotencia.
create or replace function public.clinica_version() returns integer language sql stable as $$select 42$$;
notify pgrst,'reload schema';
commit;
