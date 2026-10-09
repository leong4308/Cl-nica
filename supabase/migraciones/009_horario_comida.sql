delete from public.agenda_medicos
where hora_inicio = '09:00:00'
  and hora_fin = '14:00:00';

insert into public.agenda_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_slot)
select m.id, d.dia_semana, v.inicio, v.fin, 30
from public.perfiles_medicos m
cross join (values (1), (2), (3), (4), (5)) as d(dia_semana)
cross join (values
  ('09:00'::time, '13:00'::time),
  ('14:00'::time, '18:00'::time)
) as v(inicio, fin)
where m.esta_activo = true
  and not exists (
    select 1 from public.agenda_medicos a
    where a.medico_id = m.id
      and a.dia_semana = d.dia_semana
      and a.hora_inicio = v.inicio
  );

select
  m.id as medico_id,
  count(a.id) as bloques,
  min(a.hora_inicio) as inicio,
  max(a.hora_fin) as fin
from public.perfiles_medicos m
left join public.agenda_medicos a on a.medico_id = m.id
where m.esta_activo = true
group by m.id
order by m.id;

