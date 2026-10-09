delete from public.agenda_medicos;

insert into public.agenda_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_slot)
select m.id, d.dia_semana, b.inicio, b.fin, 25
from public.perfiles_medicos m
join (
  values
    ('Dr. Carlos Mendoza',      '06:30'::time, '07:20'::time),
    ('Dr. Carlos Mendoza',      '13:00'::time, '13:50'::time),
    ('Dr. Carlos Mendoza',      '20:30'::time, '21:20'::time),
    ('Dra. Ana López Martínez', '08:00'::time, '08:50'::time),
    ('Dra. Ana López Martínez', '14:00'::time, '14:50'::time),
    ('Dra. Ana López Martínez', '21:00'::time, '21:50'::time),
    ('Dr. Jorge Méndez Ruiz',   '07:00'::time, '07:50'::time),
    ('Dr. Jorge Méndez Ruiz',   '13:30'::time, '14:20'::time),
    ('Dr. Jorge Méndez Ruiz',   '20:00'::time, '20:50'::time),
    ('Dra. Laura Sánchez Ortiz','09:00'::time, '09:50'::time),
    ('Dra. Laura Sánchez Ortiz','15:00'::time, '15:50'::time),
    ('Dra. Laura Sánchez Ortiz','21:30'::time, '22:20'::time),
    ('Dr. Carlos Ramírez Peña',  '06:00'::time, '06:50'::time),
    ('Dr. Carlos Ramírez Peña',  '14:00'::time, '14:50'::time),
    ('Dr. Carlos Ramírez Peña',  '20:00'::time, '20:50'::time),
    ('Dra. Sofía Herrera Díaz', '08:30'::time, '09:20'::time),
    ('Dra. Sofía Herrera Díaz', '14:00'::time, '14:50'::time),
    ('Dra. Sofía Herrera Díaz', '20:00'::time, '20:50'::time)
) as b(medico, inicio, fin) on b.medico = u.nombre_completo
cross join (values (0), (1), (2), (3), (4), (5), (6)) as d(dia_semana)
join public.usuarios u on u.id = m.usuario_id
on conflict (medico_id, dia_semana, hora_inicio) do nothing;

select count(*) as bloques from public.agenda_medicos;

select distinct
  extract(epoch from (hora_fin - hora_inicio)) / 60 as min_bloque,
  (extract(epoch from (hora_fin - hora_inicio)) / 60) % 25 as sobrante,
  (extract(epoch from (hora_fin - hora_inicio)) / 60) / 25 as citas_del_bloque
from public.agenda_medicos
order by 1;
