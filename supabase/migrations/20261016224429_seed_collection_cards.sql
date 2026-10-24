-- ============================================================
-- ZONA DIAMANTE
-- Collection cards catalog
-- ============================================================
--
-- 20 cards:
--   5 Sultanes
--   5 Charros
--   5 Dorados
--   5 Algodoneros
--
-- Prices:
--   Team       = 250 points
--   Player     = 300 points
--   MVP/Figure = 500 points
--   Mascot     = AR only
--
-- Images are intentionally NULL for now.
-- They will be added later without changing collection logic.
-- ============================================================


with card_data (
    team_slug,
    slug,
    name,
    description,
    image_path,
    card_type,
    cost,
    unlock_method,
    is_active
) as (
    values

    -- ========================================================
    -- SULTANES DE MONTERREY
    -- ========================================================

    (
        'sultanes-mty',
        'sultanes-de-monterrey',
        'Sultanes de Monterrey',
        'Carta del equipo Sultanes de Monterrey, organización fundada en 1939 y una de las de mayor tradición de la Liga Mexicana de Beisbol.',
        null,
        'team',
        250,
        'points',
        true
    ),

    (
        'sultanes-mty',
        'perro-sultan',
        'Perro Sultán',
        'Mascota emblemática de los Sultanes de Monterrey. El personaje surgió en 1988 y se convirtió en uno de los símbolos más reconocibles del club.',
        null,
        'mascot',
        0,
        'ar',
        true
    ),

    (
        'sultanes-mty',
        'ramiro-pena',
        'Ramiro Peña',
        'Carta especial de Ramiro Peña, infielder nacido el 18 de julio de 1985 y una de las figuras más reconocidas de los Sultanes de Monterrey.',
        null,
        'mvp_player',
        500,
        'points',
        true
    ),

    (
        'sultanes-mty',
        'josh-lester',
        'Josh Lester',
        'Carta de Josh Lester, infielder nacido el 17 de julio de 1994 y jugador de los Sultanes de Monterrey.',
        null,
        'player',
        300,
        'points',
        true
    ),

    (
        'sultanes-mty',
        'gustavo-nunez',
        'Gustavo Núñez',
        'Carta de Gustavo Núñez, infielder de los Sultanes de Monterrey y una pieza destacada de la ofensiva del equipo.',
        null,
        'player',
        300,
        'points',
        true
    ),


    -- ========================================================
    -- CHARROS DE JALISCO
    -- ========================================================

    (
        'charros-jal',
        'charros-de-jalisco',
        'Charros de Jalisco',
        'Carta del equipo Charros de Jalisco, una de las organizaciones históricas del beisbol mexicano y participante de la Liga Mexicana de Beisbol.',
        null,
        'team',
        250,
        'points',
        true
    ),

    (
        'charros-jal',
        'straiky',
        'Straiky',
        'Carta de Straiky, una de las mascotas representativas de los Charros de Jalisco.',
        null,
        'mascot',
        0,
        'ar',
        true
    ),

    (
        'charros-jal',
        'julian-ornelas',
        'Julián Ornelas',
        'Carta especial de Julián Ornelas, jardinero nacido el 28 de diciembre de 1996 y uno de los jugadores destacados de los Charros de Jalisco.',
        null,
        'mvp_player',
        500,
        'points',
        true
    ),

    (
        'charros-jal',
        'luis-ivan-rodriguez',
        'Luis Iván Rodríguez',
        'Carta de Luis Iván Rodríguez, lanzador nacido el 24 de agosto de 1996 y jugador de los Charros de Jalisco.',
        null,
        'player',
        300,
        'points',
        true
    ),

    (
        'charros-jal',
        'reynaldo-rodriguez',
        'Reynaldo Rodríguez',
        'Carta de Reynaldo Rodríguez, primera base colombiano y jugador con experiencia dentro de los Charros de Jalisco.',
        null,
        'player',
        300,
        'points',
        true
    ),


    -- ========================================================
    -- DORADOS DE CHIHUAHUA
    -- ========================================================

    (
        'dorados-chi',
        'dorados-de-chihuahua',
        'Dorados de Chihuahua',
        'Carta del equipo Dorados de Chihuahua, organización con una larga tradición beisbolera y presencia histórica en la Liga Mexicana de Beisbol.',
        null,
        'team',
        250,
        'points',
        true
    ),

    (
        'dorados-chi',
        'pancho-pistolas',
        'Pancho Pistolas',
        'Carta de Pancho Pistolas, una de las mascotas tradicionales de los Dorados de Chihuahua.',
        null,
        'mascot',
        0,
        'ar',
        true
    ),

    (
        'dorados-chi',
        'angel-bravo',
        'Ángel Bravo',
        'Carta especial de Ángel Bravo, figura histórica ligada a los Dorados de Chihuahua y uno de los jugadores emblemáticos de la historia del equipo.',
        null,
        'mvp_player',
        500,
        'points',
        true
    ),

    (
        'dorados-chi',
        'jesus-loya',
        'Jesús Loya',
        'Carta de Jesús Loya, jardinero nacido el 15 de junio de 1992 y jugador de los Dorados de Chihuahua.',
        null,
        'player',
        300,
        'points',
        true
    ),

    (
        'dorados-chi',
        'brainer-bonaci',
        'Brainer Bonaci',
        'Carta de Brainer Bonaci, infielder venezolano nacido el 9 de julio de 2002 y jugador de los Dorados de Chihuahua.',
        null,
        'player',
        300,
        'points',
        true
    ),


    -- ========================================================
    -- ALGODONEROS DE UNION LAGUNA
    -- ========================================================

    (
        'algodoneros-ul',
        'algodoneros-union-laguna',
        'Algodoneros de Unión Laguna',
        'Carta del equipo Algodoneros de Unión Laguna, organización profesional fundada en 1940 y representante histórico de la Comarca Lagunera.',
        null,
        'team',
        250,
        'points',
        true
    ),

    (
        'algodoneros-ul',
        'pollo-algodonero',
        'Pollo Algodonero',
        'Carta del Pollo Algodonero, mascota emblemática de los Algodoneros de Unión Laguna.',
        null,
        'mascot',
        0,
        'ar',
        true
    ),

    (
        'algodoneros-ul',
        'nicholas-torres',
        'Nicholas Torres',
        'Carta especial de Nicholas Torres, jardinero nacido el 30 de junio de 1993 y una de las figuras ofensivas de los Algodoneros de Unión Laguna.',
        null,
        'mvp_player',
        500,
        'points',
        true
    ),

    (
        'algodoneros-ul',
        'jacob-barnes',
        'Jacob Barnes',
        'Carta de Jacob Barnes, lanzador derecho nacido el 14 de abril de 1990 y jugador de los Algodoneros de Unión Laguna.',
        null,
        'player',
        300,
        'points',
        true
    ),

    (
        'algodoneros-ul',
        'mason-martin',
        'Mason Martin',
        'Carta de Mason Martin, primera base nacido el 2 de junio de 1999 y jugador de los Algodoneros de Unión Laguna.',
        null,
        'player',
        300,
        'points',
        true
    )
)

insert into public.cards (
    team_id,
    slug,
    name,
    description,
    image_path,
    card_type,
    cost,
    unlock_method,
    is_active
)
select
    teams.id,
    card_data.slug,
    card_data.name,
    card_data.description,
    card_data.image_path,
    card_data.card_type,
    card_data.cost,
    card_data.unlock_method,
    card_data.is_active
from card_data
join public.teams
    on teams.slug = card_data.team_slug

on conflict (slug)
do update set
    team_id = excluded.team_id,
    name = excluded.name,
    description = excluded.description,
    image_path = excluded.image_path,
    card_type = excluded.card_type,
    cost = excluded.cost,
    unlock_method = excluded.unlock_method,
    is_active = excluded.is_active,
    updated_at = now();


-- ============================================================
-- Safety check
-- The migration must end with exactly the expected 20 cards.
-- ============================================================

do $$
declare
    v_card_count integer;
begin
    select count(*)
    into v_card_count
    from public.cards
    where slug in (
        'sultanes-de-monterrey',
        'perro-sultan',
        'ramiro-pena',
        'josh-lester',
        'gustavo-nunez',

        'charros-de-jalisco',
        'straiky',
        'julian-ornelas',
        'luis-ivan-rodriguez',
        'reynaldo-rodriguez',

        'dorados-de-chihuahua',
        'pancho-pistolas',
        'angel-bravo',
        'jesus-loya',
        'brainer-bonaci',

        'algodoneros-union-laguna',
        'pollo-algodonero',
        'nicholas-torres',
        'jacob-barnes',
        'mason-martin'
    );

    if v_card_count <> 20 then
        raise exception
            'Expected 20 collection cards, found %.',
            v_card_count;
    end if;
end;
$$;