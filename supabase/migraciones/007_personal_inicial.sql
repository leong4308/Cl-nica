insert into public.usuarios (correo, nombre_completo, rol, telefono)
values
  ('medico1@clinicanova.com', 'Dra. Ana López Martínez',    'medico', '555-1001'),
  ('medico2@clinicanova.com', 'Dr. Jorge Méndez Ruiz',     'medico', '555-1002'),
  ('medico3@clinicanova.com', 'Dra. Laura Sánchez Ortiz',  'medico', '555-1003'),
  ('medico4@clinicanova.com', 'Dr. Carlos Ramírez Peña',   'medico', '555-1004'),
  ('medico5@clinicanova.com', 'Dra. Sofía Herrera Díaz',   'medico', '555-1005')
on conflict (correo) do nothing;

insert into public.perfiles_medicos (usuario_id, clinica_id, especialidad, cedula_profesional, duracion_consulta)
select u.id, 1, v.especialidad, v.cedula, v.duracion
from public.usuarios u
join (values
  ('medico1@clinicanova.com', 'Medicina general',  'CED-1001', 20),
  ('medico2@clinicanova.com', 'Cardiología',       'CED-1002', 30),
  ('medico3@clinicanova.com', 'Pediatría',         'CED-1003', 20),
  ('medico4@clinicanova.com', 'Traumatología',     'CED-1004', 25),
  ('medico5@clinicanova.com', 'Dermatología',      'CED-1005', 20)
) as v(correo, especialidad, cedula, duracion) on v.correo = u.correo
on conflict (usuario_id, clinica_id) do nothing;

insert into public.agenda_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_slot)
select m.id, d.dia_semana, '09:00'::time, '14:00'::time, 30
from public.perfiles_medicos m
cross join (values (1), (2), (3), (4), (5)) as d(dia_semana)
where m.esta_activo = true
  and m.id not in (select medico_id from public.agenda_medicos)
on conflict (medico_id, dia_semana, hora_inicio) do nothing;

insert into public.usuarios (correo, nombre_completo, rol, telefono)
values
  ('enfermero1@clinicanova.com', 'Luis Fernando Ortiz',    'enfermero', '555-2001'),
  ('enfermero2@clinicanova.com', 'Ana Paola Garrido',       'enfermero', '555-2002'),
  ('enfermero3@clinicanova.com', 'Miguel Ángel Cabrera',   'enfermero', '555-2003'),
  ('enfermero4@clinicanova.com', 'Rosa Elena Fuentes',     'enfermero', '555-2004'),
  ('enfermero5@clinicanova.com', 'Javier Morales singleton','enfermero', '555-2005')
on conflict (correo) do nothing;

insert into public.perfiles_enfermeros (usuario_id, clinica_id, especialidad)
select u.id, 1, 'Enfermería clínica'
from public.usuarios u
where u.correo in (
  'enfermero1@clinicanova.com','enfermero2@clinicanova.com','enfermero3@clinicanova.com',
  'enfermero4@clinicanova.com','enfermero5@clinicanova.com'
)
on conflict do nothing;

insert into public.usuarios (correo, nombre_completo, rol, telefono)
values
  ('recepcion1@clinicanova.com', 'Claudia Beatriz Núñez',   'recepcionista', '555-3001'),
  ('recepcion2@clinicanova.com', 'Fernando José Ibarra',   'recepcionista', '555-3002'),
  ('recepcion3@clinicanova.com', 'Paola Estefanía Ruiz',   'recepcionista', '555-3003'),
  ('recepcion4@clinicanova.com', 'Héctor Manuel Vidal',    'recepcionista', '555-3004'),
  ('recepcion5@clinicanova.com', 'Lucía Alejandra Ponce',  'recepcionista', '555-3005')
on conflict (correo) do nothing;

insert into public.usuarios (correo, nombre_completo, rol, telefono)
values
  ('paciente1@demo.com', 'María Fernanda Ruiz',      'paciente', '555-4001'),
  ('paciente2@demo.com', 'Juan Carlos García',       'paciente', '555-4002'),
  ('paciente3@demo.com', 'Ana Isabel Martínez',      'paciente', '555-4003'),
  ('paciente4@demo.com', 'Pedro Luis Hernández',     'paciente', '555-4004'),
  ('paciente5@demo.com', 'Laura Sofía Ramírez',       'paciente', '555-4005')
on conflict (correo) do nothing;

insert into public.perfiles_pacientes (usuario_id, fecha_nacimiento, genero, telefono_emergencia)
select u.id, v.nac, v.gen, v.tel
from public.usuarios u
join (values
  ('paciente1@demo.com', '1988-03-14', 'F', '555-9001'),
  ('paciente2@demo.com', '1979-07-22', 'M', '555-9002'),
  ('paciente3@demo.com', '1996-11-05', 'F', '555-9003'),
  ('paciente4@demo.com', '1971-05-30', 'M', '555-9004'),
  ('paciente5@demo.com', '2001-02-18', 'F', '555-9005')
) as v(correo, nac, gen, tel) on v.correo = u.correo
on conflict (usuario_id) do nothing;

select rol, count(*) as total
from public.usuarios
where esta_activo = true
group by rol
order by rol;
