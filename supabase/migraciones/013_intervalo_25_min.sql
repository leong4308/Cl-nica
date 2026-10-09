update public.perfiles_medicos
set duracion_consulta = 25
where esta_activo = true
  and duracion_consulta is distinct from 25;

update public.agenda_medicos
set duracion_slot = 25
where duracion_slot is distinct from 25;

select
  m.id as medico_id,
  u.nombre_completo as medico,
  m.duracion_consulta,
  min(a.duracion_slot) as duracion_slot_min,
  max(a.duracion_slot) as duracion_slot_max,
  (m.duracion_consulta = min(a.duracion_slot)) as coinciden
from public.perfiles_medicos m
join public.usuarios u on u.id = m.usuario_id
left join public.agenda_medicos a on a.medico_id = m.id
where m.esta_activo = true
group by m.id, u.nombre_completo, m.duracion_consulta
order by m.id;

