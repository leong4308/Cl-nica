delete from public.agenda_medicos;

insert into public.agenda_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_slot)
select m.id, d.dia_semana, b.inicio, b.fin, 25
from public.perfiles_medicos m
join (
  values
    ('13:00'::time, '14:15'::time),
    ('15:30'::time, '20:05'::time)
) as b(inicio, fin) on true
cross join (values (0), (1), (2), (3), (4), (5), (6)) as d(dia_semana)
where m.esta_activo = true
on conflict (medico_id, dia_semana, hora_inicio) do nothing;

select count(*) as bloques from public.agenda_medicos;

select distinct
  extract(epoch from (hora_fin - hora_inicio)) / 60 as min_bloque,
  (extract(epoch from (hora_fin - hora_inicio)) / 60) / 25 as citas_del_bloque,
  (extract(epoch from (hora_fin - hora_inicio)) / 60) % 25 as sobrante
from public.agenda_medicos
order by 1;

select distinct
  extract(epoch from (hora_fin - hora_inicio)) / 60 as min_bloque,
  (extract(epoch from (hora_fin - hora_inicio)) / 60) / 25 as citas_del_bloque,
  (extract(epoch from (hora_fin - hora_inicio)) / 60) % 25 as sobrante
from public.agenda_medicos
order by 1;

