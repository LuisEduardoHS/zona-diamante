-- Keep dark team marks legible on the team's colored card background.
-- Original vector logos are preserved, with a light backing and margin.
update public.cards as c
set image_path='https://mackpshtousktzumznmo.supabase.co/storage/v1/object/public/card-images/'||art.object_path
from (values
    ('sultanes-de-monterrey','20261108/sultanes-de-monterrey-193c561ec277.svg'),
    ('dorados-de-chihuahua','20261108/dorados-de-chihuahua-0aa4e381aa19.svg'),
    ('charros-de-jalisco','20261108/charros-de-jalisco-aef25c41bd07.svg'),
    ('algodoneros-union-laguna','20261108/algodoneros-union-laguna-2b832f5ca046.svg')
) as art(slug,object_path)
where c.slug=art.slug and c.image_path like 'https://mackpshtousktzumznmo.supabase.co/storage/v1/object/public/card-images/%';
