-- ============================================================
-- STORAGE: AVATARES DE USUARIO
-- ============================================================

-- Bucket público para almacenar avatares de usuario.
-- Máximo 5 MB.
-- Formatos permitidos: JPG, PNG y WebP.

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================
-- POLÍTICAS RLS
--
-- Estructura esperada:
--
-- avatars/
--   <user_id>/
--     profile.jpg
--
-- Cada usuario sólo puede administrar archivos dentro
-- de una carpeta cuyo nombre sea su propio auth.uid().
-- ============================================================


-- Permite consultar los objetos propios.
-- También es necesaria para operaciones de upsert.
DROP POLICY IF EXISTS "avatars_select_own"
ON storage.objects;

CREATE POLICY "avatars_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);


-- Permite subir únicamente dentro de la carpeta propia.
DROP POLICY IF EXISTS "avatars_insert_own"
ON storage.objects;

CREATE POLICY "avatars_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);


-- Permite modificar únicamente objetos propios.
DROP POLICY IF EXISTS "avatars_update_own"
ON storage.objects;

CREATE POLICY "avatars_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);


-- Permite eliminar únicamente objetos propios.
DROP POLICY IF EXISTS "avatars_delete_own"
ON storage.objects;

CREATE POLICY "avatars_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);