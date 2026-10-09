delete from public.perfiles_pacientes p
using public.usuarios u
where p.usuario_id = u.id
  and u.correo = 'doc@doc.com';

select
  u.correo,
  u.rol,
  (select count(*) from public.perfiles_medicos  m where m.usuario_id = u.id) as perfiles_medico,
  (select count(*) from public.perfiles_pacientes p where p.usuario_id = u.id) as perfiles_paciente
from public.usuarios u
where u.correo = 'doc@doc.com';

