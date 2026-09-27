-- ============================================================
-- ZONA DIAMANTE
-- Development seed
-- ============================================================


-- ============================================================
-- TEAMS
-- Datos migrados desde frontend/public/data/equipos.json
-- ============================================================

insert into public.teams (
    slug,
    name,
    city,
    zone,
    history,
    colors,
    details
)
values

-- ------------------------------------------------------------
-- SULTANES
-- ------------------------------------------------------------
(
    'sultanes-mty',
    'Sultanes',
    'Monterrey',
    'Zona Norte de la LMB',

    $$Los Sultanes de Monterrey suman <span class="text-red-500 font-black">10</span> campeonatos de la Liga Mexicana de Béisbol en su historia, además de haber obtenido 13 títulos de la Zona Norte.$$,

    jsonb_build_object(
        'primario', '#002D62',
        'secundario', '#E51837',
        'gradienteDeg', 'to-b'
    ),

    jsonb_build_object(
        'imagenes', jsonb_build_object(
            'logoFondo', './assets/img/equipos/sultanes/logo-bg.webp',
            'jugadorCarrusel', './assets/img/equipos/sultanes/jugador.webp'
        ),

        'record', '53 - 37',
        'posicion', '1.°',

        'estadisticas', jsonb_build_object(
            'pct', '.589',
            'streak', 'G2',
            'avg', '.295',
            'hr', 84,
            'ci', 415
        ),

        'estadio', jsonb_build_object(
            'nombre', 'Estadio Mobil Super',
            'ubicacion', 'Monterrey, Nuevo León',
            'imagen', './assets/img/equipos/sultanes/estadio.webp'
        ),

        'mascota', jsonb_build_object(
            'nombre', 'El Perro Sultán',
            'imagen', './assets/img/equipos/sultanes/mascota.webp'
        ),

        'palmares', jsonb_build_array(
            '10 Campeonatos de la LMB',
            'Múltiples títulos de la Zona Norte'
        ),

        'mvp', jsonb_build_object(
            'nombre', 'Ramiro Peña',
            'imagen', './assets/img/equipos/sultanes/mvp.webp'
        ),

        'calendario', jsonb_build_array(
            jsonb_build_object(
                'oponente', 'Dorados',
                'fecha', 'Próximamente',
                'hora', 'Por definir'
            )
        )
    )
),


-- ------------------------------------------------------------
-- DORADOS
-- ------------------------------------------------------------
(
    'dorados-chi',
    'Dorados',
    'Chihuahua',
    'Zona Norte de la LMB',

    $$Los Dorados de Chihuahua son un equipo con una inmensa tradición en el 'Estado Grande'. Regresaron recientemente a la LMB para revivir la pasión del béisbol en la capital chihuahuense.$$,

    jsonb_build_object(
        'primario', '#4B166B',
        'secundario', '#F2A900',
        'gradienteDeg', 'to-b'
    ),

    jsonb_build_object(
        'imagenes', jsonb_build_object(
            'logoFondo', './assets/img/equipos/Dorados/logo-bg.webp',
            'jugadorCarrusel', './assets/img/equipos/Dorados/player.webp'
        ),

        'record', '33 - 57',
        'posicion', '10.°',

        'estadisticas', jsonb_build_object(
            'pct', '.367',
            'streak', 'P3',
            'avg', '.265',
            'hr', 55,
            'ci', 310
        ),

        'estadio', jsonb_build_object(
            'nombre', 'Estadio Monumental Chihuahua',
            'ubicacion', 'Chihuahua, Chihuahua',
            'imagen', './assets/img/equipos/Dorados/estadio.jpg'
        ),

        'mascota', jsonb_build_object(
            'nombre', 'Dorado',
            'imagen', './assets/img/equipos/Dorados/mascota.webp'
        ),

        'palmares', jsonb_build_array(
            '6 Campeonatos de la Liga Estatal',
            'Equipo de expansión LMB 2024'
        ),

        'mvp', jsonb_build_object(
            'nombre', 'Leo Piña',
            'imagen', './assets/img/equipos/Dorados/mvp.webp'
        ),

        'calendario', jsonb_build_array(
            jsonb_build_object(
                'oponente', 'Sultanes',
                'fecha', 'Próximamente',
                'hora', 'Por definir'
            )
        )
    )
),


-- ------------------------------------------------------------
-- CHARROS
-- ------------------------------------------------------------
(
    'charros-jal',
    'Charros',
    'Jalisco',
    'Zona Norte de la LMB',

    $$Una franquicia emblemática del béisbol mexicano. Los Charros compiten tanto en verano (LMB) como en invierno (LMP), siempre arropados por una de las mejores aficiones del país en Jalisco.$$,

    jsonb_build_object(
        'primario', '#002C5F',
        'secundario', '#00A3E0',
        'gradienteDeg', 'to-b'
    ),

    jsonb_build_object(
        'imagenes', jsonb_build_object(
            'logoFondo', './assets/img/equipos/Charros/logo-bg.webp',
            'jugadorCarrusel', './assets/img/equipos/Charros/player.webp'
        ),

        'record', '43 - 47',
        'posicion', '6.°',

        'estadisticas', jsonb_build_object(
            'pct', '.478',
            'streak', 'G1',
            'avg', '.280',
            'hr', 70,
            'ci', 380
        ),

        'estadio', jsonb_build_object(
            'nombre', 'Estadio Panamericano',
            'ubicacion', 'Zapopan, Jalisco',
            'imagen', './assets/img/equipos/Charros/estadio.webp'
        ),

        'mascota', jsonb_build_object(
            'nombre', 'El Charro',
            'imagen', './assets/img/equipos/Charros/mascota.jpg'
        ),

        'palmares', jsonb_build_array(
            '2 Campeonatos de LMB (1967, 1971)',
            '2 Campeonatos de LMP'
        ),

        'mvp', jsonb_build_object(
            'nombre', 'Japhet Amador',
            'imagen', './assets/img/equipos/Charros/mvp.webp'
        ),

        'calendario', jsonb_build_array(
            jsonb_build_object(
                'oponente', 'Algodoneros',
                'fecha', 'Próximamente',
                'hora', 'Por definir'
            )
        )
    )
),


-- ------------------------------------------------------------
-- ALGODONEROS
-- ------------------------------------------------------------
(
    'algodoneros-ul',
    'Algodoneros',
    'Unión Laguna',
    'Zona Norte de la LMB',

    $$Fundados en 1940, son el equipo profesional con más arraigo en la Comarca Lagunera. Son conocidos por su histórico y hermoso Estadio Revolución y su apasionada afición guinda.$$,

    jsonb_build_object(
        'primario', '#5B1126',
        'secundario', '#B68B45',
        'gradienteDeg', 'to-b'
    ),

    jsonb_build_object(
        'imagenes', jsonb_build_object(
            'logoFondo', './assets/img/equipos/Algonoderos/logo-bg.webp',
            'jugadorCarrusel', './assets/img/equipos/Algonoderos/player.webp'
        ),

        'record', '52 - 39',
        'posicion', '3.°',

        'estadisticas', jsonb_build_object(
            'pct', '.571',
            'streak', 'G3',
            'avg', '.288',
            'hr', 75,
            'ci', 420
        ),

        'estadio', jsonb_build_object(
            'nombre', 'Estadio Revolución',
            'ubicacion', 'Torreón, Coahuila',
            'imagen', './assets/img/equipos/Algonoderos/estadio.webp'
        ),

        'mascota', jsonb_build_object(
            'nombre', 'El Pollo Algodonero',
            'imagen', './assets/img/equipos/Algonoderos/mascota.webp'
        ),

        'palmares', jsonb_build_array(
            '2 Campeonatos de LMB (1942, 1950)',
            'Campeón Zona Norte (2023)'
        ),

        'mvp', jsonb_build_object(
            'nombre', 'Nick Torres',
            'imagen', './assets/img/equipos/Algonoderos/mvp.webp'
        ),

        'calendario', jsonb_build_array(
            jsonb_build_object(
                'oponente', 'Charros',
                'fecha', 'Próximamente',
                'hora', 'Por definir'
            )
        )
    )
);