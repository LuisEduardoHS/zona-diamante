-- Public catalog artwork, maintained only through the server/service key.
-- Public buckets allow image downloads; no client INSERT/UPDATE/DELETE policy
-- is added to storage.objects. Existing avatar policies stay scoped to avatars.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('card-images','card-images',true,2097152,
        array['image/webp','image/png','image/jpeg','image/svg+xml'])
on conflict (id) do update set
    public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;
