insert into public.agenda_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_slot)
select m.id, d.dia_semana, v.inicio, v.fin, 30
from public.perfiles_medicos m
cross join (values (0), (6)) as d(dia_semana)
cross join (values
  ('09:00'::time, '13:00'::time),
  ('14:00'::time, '18:00'::time)
) as v(inicio, fin)
where m.esta_activo = true
on conflict (medico_id, dia_semana, hora_inicio) do nothing;

select
  m.id as medico_id,
  (select nombre_completo from public.usuarios where id = m.usuario_id) as medico,
  count(a.id) as bloques,
  count(distinct a.dia_semana) as dias,
  min(a.hora_inicio) as inicio,
  max(a.hora_fin) as fin
from public.perfiles_medicos m
left join public.agenda_medicos a on a.medico_id = m.id
where m.esta_activo = true
group by m.id
order by m.id;
