insert into public.perfiles_pacientes (
  usuario_id,
  fecha_nacimiento,
  genero,
  telefono_emergencia,
  esta_activo
)
select
  u.id,
  date '1985-04-10',
  'M',
  '555-1099',
  true
from public.usuarios u
where u.correo = 'doc@doc.com'
  and not exists (
    select 1 from public.perfiles_pacientes p where p.usuario_id = u.id
  );

select
  u.correo,
  u.rol,
  m.id as medico_id,
  p.id as paciente_id
from public.usuarios u
left join public.perfiles_medicos  m on m.usuario_id = u.id
left join public.perfiles_pacientes p on p.usuario_id = u.id
where u.correo = 'doc@doc.com';

