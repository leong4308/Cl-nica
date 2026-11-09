-- PDF de expedientes y órdenes: máximo 2 MB por archivo, sin acceso público.
-- La API valida la sesión, el rol y el acceso al registro antes de usar Storage.
-- Las rutas son expedientes/<id>/<uuid>-<nombre>.pdf u ordenes/<id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-clinicos', 'documentos-clinicos', false, 2097152, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
