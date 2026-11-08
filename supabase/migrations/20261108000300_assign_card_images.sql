-- Reviewed sources, checksums and local copies: supabase/assets/card-images/manifest.json.
-- The objects were uploaded and publicly verified before applying this migration.
-- This public Supabase endpoint serves the shared catalog artwork in all environments.
-- Preserve any independently assigned image outside this managed bucket.
update public.cards as c
set image_path = 'https://mackpshtousktzumznmo.supabase.co/storage/v1/object/public/card-images/' || art.object_path
from (values
    ('gustavo-nunez','20261108/gustavo-nunez-ede7a9c76bcc.webp'),
    ('josh-lester','20261108/josh-lester-b68e2fe0d300.webp'),
    ('ramiro-pena','20261108/ramiro-pena-bab26ef869b1.webp'),
    ('perro-sultan','20261108/perro-sultan-dd620cafe141.webp'),
    ('sultanes-de-monterrey','20261108/sultanes-de-monterrey-86f21ac99911.svg'),
    ('brainer-bonaci','20261108/brainer-bonaci-c92180bbe3d9.webp'),
    ('jesus-loya','20261108/jesus-loya-e0dd6ff4e673.webp'),
    ('angel-bravo','20261108/angel-bravo-912e4d072b07.webp'),
    ('pancho-pistolas','20261108/pancho-pistolas-02ada419e6a7.webp'),
    ('dorados-de-chihuahua','20261108/dorados-de-chihuahua-bf761238baf5.svg'),
    ('reynaldo-rodriguez','20261108/reynaldo-rodriguez-e3ddf523d1be.webp'),
    ('luis-ivan-rodriguez','20261108/luis-ivan-rodriguez-96ea0c01e331.webp'),
    ('julian-ornelas','20261108/julian-ornelas-a330ee850f86.webp'),
    ('straiky','20261108/straiky-83164cd266ac.webp'),
    ('charros-de-jalisco','20261108/charros-de-jalisco-0560774e0dd2.svg'),
    ('mason-martin','20261108/mason-martin-6d70292e8a33.webp'),
    ('jacob-barnes','20261108/jacob-barnes-707deaa4e17d.webp'),
    ('nicholas-torres','20261108/nicholas-torres-5b89923dc580.webp'),
    ('pollo-algodonero','20261108/pollo-algodonero-33233e8003ac.webp'),
    ('algodoneros-union-laguna','20261108/algodoneros-union-laguna-57b44641eb3a.svg')
) as art(slug,object_path)
where c.slug=art.slug
  and (c.image_path is null or c.image_path like 'https://mackpshtousktzumznmo.supabase.co/storage/v1/object/public/card-images/%');
