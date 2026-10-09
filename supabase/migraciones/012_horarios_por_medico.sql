delete from public.agenda_medicos;

insert into public.agenda_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_slot)
select m.id, d.dia_semana, b.inicio, b.fin, 15
from public.perfiles_medicos m
join (
  values
    ('Dr. Carlos Mendoza',      '06:30'::time, '07:00'::time),
    ('Dr. Carlos Mendoza',      '13:00'::time, '14:00'::time),
    ('Dr. Carlos Mendoza',      '20:30'::time, '21:30'::time),
    ('Dra. Ana López Martínez', '08:00'::time, '09:00'::time),
    ('Dra. Ana López Martínez', '14:00'::time, '15:00'::time),
    ('Dra. Ana López Martínez', '21:00'::time, '22:00'::time),
    ('Dr. Jorge Méndez Ruiz',   '07:00'::time, '07:45'::time),
    ('Dr. Jorge Méndez Ruiz',   '13:30'::time, '14:30'::time),
    ('Dr. Jorge Méndez Ruiz',   '20:00'::time, '21:00'::time),
    ('Dra. Laura Sánchez Ortiz','09:00'::time, '10:00'::time),
    ('Dra. Laura Sánchez Ortiz','15:00'::time, '16:00'::time),
    ('Dra. Laura Sánchez Ortiz','21:30'::time, '22:30'::time),
    ('Dr. Carlos Ramírez Peña',  '06:00'::time, '06:45'::time),
    ('Dr. Carlos Ramírez Peña',  '14:00'::time, '15:00'::time),
    ('Dr. Carlos Ramírez Peña',  '20:00'::time, '21:00'::time),
    ('Dra. Sofía Herrera Díaz', '08:30'::time, '09:30'::time),
    ('Dra. Sofía Herrera Díaz', '14:00'::time, '15:00'::time),
    ('Dra. Sofía Herrera Díaz', '20:00'::time, '21:00'::time)
) as b(medico, inicio, fin) on b.medico = u.nombre_completo
cross join (values (0), (1), (2), (3), (4), (5), (6)) as d(dia_semana)
join public.usuarios u on u.id = m.usuario_id
on conflict (medico_id, dia_semana, hora_inicio) do nothing;

select
  u.nombre_completo as medico,
  m.especialidad,
  count(a.id) as bloques,
  count(distinct a.dia_semana) as dias,
  string_agg(distinct to_char(a.hora_inicio, 'HH24:MI') || '-' || to_char(a.hora_fin, 'HH24:MI'), ' · ' order by a.hora_inicio) as ventanas
from public.perfiles_medicos m
join public.usuarios u on u.id = m.usuario_id
left join public.agenda_medicos a on a.medico_id = m.id
where m.esta_activo = true
group by m.id, u.nombre_completo, m.especialidad
order by m.id;
