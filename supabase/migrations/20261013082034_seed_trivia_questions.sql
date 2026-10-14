-- ============================================================
-- INITIAL TRIVIA QUESTION BANK
-- 30 preguntas iniciales para Zona Diamante
-- ============================================================

do $$
declare
    question_record jsonb;
    option_record jsonb;
    inserted_question_id uuid;
begin

    for question_record in
        select value
        from jsonb_array_elements(
            $questions$
            [
              {
                "question": "¿En qué año fueron fundados los Sultanes de Monterrey?",
                "category": "history",
                "difficulty": "easy",
                "explanation": "Sultanes de Monterrey fue fundado el 20 de mayo de 1939.",
                "options": [
                  {"position": 1, "text": "1925", "is_correct": false},
                  {"position": 2, "text": "1939", "is_correct": true},
                  {"position": 3, "text": "1946", "is_correct": false},
                  {"position": 4, "text": "1952", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año consiguieron los Sultanes su primer campeonato de la LMB?",
                "category": "history",
                "difficulty": "medium",
                "explanation": "Monterrey conquistó el primer campeonato de su historia en 1943.",
                "options": [
                  {"position": 1, "text": "1939", "is_correct": false},
                  {"position": 2, "text": "1941", "is_correct": false},
                  {"position": 3, "text": "1943", "is_correct": true},
                  {"position": 4, "text": "1947", "is_correct": false}
                ]
              },
              {
                "question": "¿Cuántos campeonatos de Liga Mexicana de Beisbol han conquistado los Sultanes?",
                "category": "palmares",
                "difficulty": "easy",
                "explanation": "Sultanes de Monterrey ha conquistado 10 campeonatos de la Liga Mexicana de Beisbol.",
                "options": [
                  {"position": 1, "text": "6", "is_correct": false},
                  {"position": 2, "text": "8", "is_correct": false},
                  {"position": 3, "text": "10", "is_correct": true},
                  {"position": 4, "text": "12", "is_correct": false}
                ]
              },
              {
                "question": "¿Qué logró Sultanes entre 1947 y 1949?",
                "category": "history",
                "difficulty": "medium",
                "explanation": "Sultanes ganó tres campeonatos consecutivos en 1947, 1948 y 1949.",
                "options": [
                  {"position": 1, "text": "Un tricampeonato", "is_correct": true},
                  {"position": 2, "text": "Tres subcampeonatos", "is_correct": false},
                  {"position": 3, "text": "Cambió de ciudad", "is_correct": false},
                  {"position": 4, "text": "Dejó de participar", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año consiguieron los Sultanes su décimo campeonato de LMB?",
                "category": "palmares",
                "difficulty": "medium",
                "explanation": "Sultanes obtuvo su décimo campeonato de la LMB en 2018.",
                "options": [
                  {"position": 1, "text": "2007", "is_correct": false},
                  {"position": 2, "text": "2010", "is_correct": false},
                  {"position": 3, "text": "2015", "is_correct": false},
                  {"position": 4, "text": "2018", "is_correct": true}
                ]
              },
              {
                "question": "¿Con qué apodo se conoce históricamente a los Sultanes de Monterrey?",
                "category": "identity",
                "difficulty": "easy",
                "explanation": "Uno de los sobrenombres históricos de Sultanes de Monterrey es Fantasmas Grises.",
                "options": [
                  {"position": 1, "text": "Fantasmas Grises", "is_correct": true},
                  {"position": 2, "text": "Guerreros del Norte", "is_correct": false},
                  {"position": 3, "text": "Dorados Regios", "is_correct": false},
                  {"position": 4, "text": "Charros del Norte", "is_correct": false}
                ]
              },
              {
                "question": "¿Qué histórico bateador conectó 268 cuadrangulares con Sultanes?",
                "category": "figures",
                "difficulty": "medium",
                "explanation": "Héctor Espino es el líder histórico de cuadrangulares de Sultanes con 268.",
                "options": [
                  {"position": 1, "text": "Fernando Valenzuela", "is_correct": false},
                  {"position": 2, "text": "Héctor Espino", "is_correct": true},
                  {"position": 3, "text": "Vinicio Castilla", "is_correct": false},
                  {"position": 4, "text": "Benjamín Gil", "is_correct": false}
                ]
              },
              {
                "question": "¿Cómo se llama la mascota de Sultanes mostrada en Zona Diamante?",
                "category": "mascots",
                "difficulty": "easy",
                "explanation": "En Zona Diamante, la mascota de Sultanes aparece como El Perro Sultán.",
                "options": [
                  {"position": 1, "text": "El Perro Sultán", "is_correct": true},
                  {"position": 2, "text": "El León Regio", "is_correct": false},
                  {"position": 3, "text": "El Fantasma", "is_correct": false},
                  {"position": 4, "text": "El Toro Norteño", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué ciudad tienen su sede los Dorados?",
                "category": "team",
                "difficulty": "easy",
                "explanation": "Los Dorados de la LMB representan a la ciudad de Chihuahua.",
                "options": [
                  {"position": 1, "text": "Torreón", "is_correct": false},
                  {"position": 2, "text": "Monterrey", "is_correct": false},
                  {"position": 3, "text": "Chihuahua", "is_correct": true},
                  {"position": 4, "text": "Zapopan", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año regresaron los Dorados de Chihuahua a la LMB después de una larga ausencia?",
                "category": "history",
                "difficulty": "easy",
                "explanation": "Dorados de Chihuahua regresó a la Liga Mexicana de Beisbol para la temporada 2024.",
                "options": [
                  {"position": 1, "text": "2020", "is_correct": false},
                  {"position": 2, "text": "2022", "is_correct": false},
                  {"position": 3, "text": "2023", "is_correct": false},
                  {"position": 4, "text": "2024", "is_correct": true}
                ]
              },
              {
                "question": "¿Cuántos años habían pasado sin Dorados en la LMB antes de su regreso de 2024?",
                "category": "history",
                "difficulty": "medium",
                "explanation": "Dorados regresó a la LMB en 2024 después de 14 años de ausencia.",
                "options": [
                  {"position": 1, "text": "8 años", "is_correct": false},
                  {"position": 2, "text": "10 años", "is_correct": false},
                  {"position": 3, "text": "14 años", "is_correct": true},
                  {"position": 4, "text": "20 años", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año aparecieron por primera vez los Dorados de Chihuahua en la LMB?",
                "category": "history",
                "difficulty": "medium",
                "explanation": "La primera aparición de Dorados de Chihuahua en la LMB ocurrió en 1940.",
                "options": [
                  {"position": 1, "text": "1930", "is_correct": false},
                  {"position": 2, "text": "1940", "is_correct": true},
                  {"position": 3, "text": "1949", "is_correct": false},
                  {"position": 4, "text": "1973", "is_correct": false}
                ]
              },
              {
                "question": "¿Cuál es la casa de los Dorados de Chihuahua en la LMB?",
                "category": "stadiums",
                "difficulty": "easy",
                "explanation": "Dorados juega como local en el Estadio Monumental Chihuahua.",
                "options": [
                  {"position": 1, "text": "Estadio Revolución", "is_correct": false},
                  {"position": 2, "text": "Estadio Panamericano", "is_correct": false},
                  {"position": 3, "text": "Estadio Monumental Chihuahua", "is_correct": true},
                  {"position": 4, "text": "Estadio Mobil Super", "is_correct": false}
                ]
              },
              {
                "question": "¿Qué histórico parque de Chihuahua fue casa de Dorados en etapas anteriores?",
                "category": "stadiums",
                "difficulty": "medium",
                "explanation": "El Estadio Manuel L. Almanza fue casa de Dorados durante etapas históricas de la organización.",
                "options": [
                  {"position": 1, "text": "Manuel L. Almanza", "is_correct": true},
                  {"position": 2, "text": "Alfredo Harp Helú", "is_correct": false},
                  {"position": 3, "text": "Kukulcán", "is_correct": false},
                  {"position": 4, "text": "Beto Ávila", "is_correct": false}
                ]
              },
              {
                "question": "¿Con qué sobrenombre se identifica también a los Dorados de Chihuahua?",
                "category": "identity",
                "difficulty": "medium",
                "explanation": "Dorados de Chihuahua también es identificado como la División del Norte.",
                "options": [
                  {"position": 1, "text": "División del Norte", "is_correct": true},
                  {"position": 2, "text": "Fantasmas Grises", "is_correct": false},
                  {"position": 3, "text": "Máquina Guinda", "is_correct": false},
                  {"position": 4, "text": "Caporales", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué años fueron campeones de LMB los Charros de Jalisco durante su etapa histórica?",
                "category": "palmares",
                "difficulty": "medium",
                "explanation": "Charros de Jalisco conquistó campeonatos de la LMB en 1967 y 1971.",
                "options": [
                  {"position": 1, "text": "1955 y 1956", "is_correct": false},
                  {"position": 2, "text": "1967 y 1971", "is_correct": true},
                  {"position": 3, "text": "1988 y 1991", "is_correct": false},
                  {"position": 4, "text": "2007 y 2018", "is_correct": false}
                ]
              },
              {
                "question": "¿A qué equipo remontaron los Charros un 0-3 en la Serie Final de 1971?",
                "category": "history",
                "difficulty": "medium",
                "explanation": "Charros remontó una desventaja de 0-3 ante Saraperos de Saltillo y ganó cuatro juegos consecutivos.",
                "options": [
                  {"position": 1, "text": "Sultanes de Monterrey", "is_correct": false},
                  {"position": 2, "text": "Diablos Rojos del México", "is_correct": false},
                  {"position": 3, "text": "Saraperos de Saltillo", "is_correct": true},
                  {"position": 4, "text": "Algodoneros de Unión Laguna", "is_correct": false}
                ]
              },
              {
                "question": "¿Quién dirigió a Charros durante la histórica remontada de 1971?",
                "category": "figures",
                "difficulty": "hard",
                "explanation": "Benjamín “Cananea” Reyes dirigió a Charros durante el campeonato y la remontada de 1971.",
                "options": [
                  {"position": 1, "text": "Lázaro Salazar", "is_correct": false},
                  {"position": 2, "text": "Benjamín “Cananea” Reyes", "is_correct": true},
                  {"position": 3, "text": "Roberto Kelly", "is_correct": false},
                  {"position": 4, "text": "Homar Rojas", "is_correct": false}
                ]
              },
              {
                "question": "¿A qué liga regresaron los Charros de Jalisco en 2014?",
                "category": "history",
                "difficulty": "medium",
                "explanation": "En 2014 Charros regresó al beisbol profesional participando en la Liga Mexicana del Pacífico.",
                "options": [
                  {"position": 1, "text": "Liga Mexicana de Beisbol", "is_correct": false},
                  {"position": 2, "text": "Liga Mexicana del Pacífico", "is_correct": true},
                  {"position": 3, "text": "Major League Baseball", "is_correct": false},
                  {"position": 4, "text": "Liga Mexicana de Softbol", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año regresaron los Charros de Jalisco a la Liga Mexicana de Beisbol?",
                "category": "history",
                "difficulty": "easy",
                "explanation": "Charros de Jalisco concretó su regreso a la LMB en la temporada 2024.",
                "options": [
                  {"position": 1, "text": "2014", "is_correct": false},
                  {"position": 2, "text": "2018", "is_correct": false},
                  {"position": 3, "text": "2022", "is_correct": false},
                  {"position": 4, "text": "2024", "is_correct": true}
                ]
              },
              {
                "question": "¿Cómo se llama el estadio en el que juegan los Charros de Jalisco?",
                "category": "stadiums",
                "difficulty": "easy",
                "explanation": "Charros de Jalisco juega sus partidos como local en el Estadio Panamericano, en Zapopan.",
                "options": [
                  {"position": 1, "text": "Estadio Revolución", "is_correct": false},
                  {"position": 2, "text": "Estadio Monumental Chihuahua", "is_correct": false},
                  {"position": 3, "text": "Estadio Panamericano", "is_correct": true},
                  {"position": 4, "text": "Estadio Mobil Super", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año comenzó la primera etapa de Jalisco en la Liga Mexicana de Beisbol?",
                "category": "history",
                "difficulty": "medium",
                "explanation": "La primera etapa de la franquicia jalisciense en la LMB comenzó en 1949.",
                "options": [
                  {"position": 1, "text": "1939", "is_correct": false},
                  {"position": 2, "text": "1940", "is_correct": false},
                  {"position": 3, "text": "1949", "is_correct": true},
                  {"position": 4, "text": "1964", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué ciudad se ubica el Estadio Revolución, casa de Algodoneros?",
                "category": "stadiums",
                "difficulty": "easy",
                "explanation": "El Estadio Revolución se encuentra en Torreón, Coahuila.",
                "options": [
                  {"position": 1, "text": "Chihuahua", "is_correct": false},
                  {"position": 2, "text": "Torreón", "is_correct": true},
                  {"position": 3, "text": "Monterrey", "is_correct": false},
                  {"position": 4, "text": "Guadalajara", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año disputó Unión Laguna su primer juego profesional?",
                "category": "history",
                "difficulty": "medium",
                "explanation": "Unión Laguna disputó su primer juego profesional el 30 de marzo de 1940.",
                "options": [
                  {"position": 1, "text": "1930", "is_correct": false},
                  {"position": 2, "text": "1935", "is_correct": false},
                  {"position": 3, "text": "1940", "is_correct": true},
                  {"position": 4, "text": "1950", "is_correct": false}
                ]
              },
              {
                "question": "¿Contra qué equipo disputó Unión Laguna su primer juego profesional?",
                "category": "history",
                "difficulty": "hard",
                "explanation": "El primer juego profesional de Unión Laguna fue frente a Nuevo Laredo.",
                "options": [
                  {"position": 1, "text": "Monterrey", "is_correct": false},
                  {"position": 2, "text": "Nuevo Laredo", "is_correct": true},
                  {"position": 3, "text": "Jalisco", "is_correct": false},
                  {"position": 4, "text": "Chihuahua", "is_correct": false}
                ]
              },
              {
                "question": "¿Cuál fue el marcador de la primera victoria profesional de Unión Laguna?",
                "category": "history",
                "difficulty": "hard",
                "explanation": "Unión Laguna obtuvo su primera victoria profesional al vencer 5 carreras por 4 a Nuevo Laredo.",
                "options": [
                  {"position": 1, "text": "2-1", "is_correct": false},
                  {"position": 2, "text": "3-0", "is_correct": false},
                  {"position": 3, "text": "5-4", "is_correct": true},
                  {"position": 4, "text": "10-2", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año obtuvo Unión Laguna su primer campeonato?",
                "category": "palmares",
                "difficulty": "medium",
                "explanation": "Unión Laguna conquistó el primer campeonato de su historia en 1942.",
                "options": [
                  {"position": 1, "text": "1940", "is_correct": false},
                  {"position": 2, "text": "1942", "is_correct": true},
                  {"position": 3, "text": "1947", "is_correct": false},
                  {"position": 4, "text": "1950", "is_correct": false}
                ]
              },
              {
                "question": "¿En qué año obtuvo Unión Laguna su segundo campeonato?",
                "category": "palmares",
                "difficulty": "medium",
                "explanation": "El segundo campeonato de Unión Laguna llegó en 1950.",
                "options": [
                  {"position": 1, "text": "1943", "is_correct": false},
                  {"position": 2, "text": "1947", "is_correct": false},
                  {"position": 3, "text": "1950", "is_correct": true},
                  {"position": 4, "text": "1962", "is_correct": false}
                ]
              },
              {
                "question": "¿Qué figura fue Pitcher del Año en 1942 durante el primer campeonato de Unión Laguna?",
                "category": "figures",
                "difficulty": "hard",
                "explanation": "Martín Dihigo fue Pitcher del Año en 1942, temporada del primer campeonato de Unión Laguna.",
                "options": [
                  {"position": 1, "text": "Martín Dihigo", "is_correct": true},
                  {"position": 2, "text": "Héctor Espino", "is_correct": false},
                  {"position": 3, "text": "Fernando Valenzuela", "is_correct": false},
                  {"position": 4, "text": "Lázaro Salazar", "is_correct": false}
                ]
              },
              {
                "question": "¿Cuál es el estadio histórico de los Algodoneros de Unión Laguna?",
                "category": "stadiums",
                "difficulty": "easy",
                "explanation": "El Estadio Revolución es la histórica casa de los Algodoneros de Unión Laguna.",
                "options": [
                  {"position": 1, "text": "Estadio Panamericano", "is_correct": false},
                  {"position": 2, "text": "Estadio Monumental Chihuahua", "is_correct": false},
                  {"position": 3, "text": "Estadio Revolución", "is_correct": true},
                  {"position": 4, "text": "Estadio Alfredo Harp Helú", "is_correct": false}
                ]
              }
            ]
            $questions$::jsonb
        )
    loop

        insert into public.trivia_questions (
            question_text,
            category,
            difficulty,
            explanation,
            is_active
        )
        values (
            question_record ->> 'question',
            question_record ->> 'category',
            question_record ->> 'difficulty',
            question_record ->> 'explanation',
            true
        )
        returning id into inserted_question_id;


        for option_record in
            select value
            from jsonb_array_elements(question_record -> 'options')
        loop

            insert into public.trivia_options (
                question_id,
                option_text,
                position,
                is_correct
            )
            values (
                inserted_question_id,
                option_record ->> 'text',
                (option_record ->> 'position')::smallint,
                (option_record ->> 'is_correct')::boolean
            );

        end loop;

    end loop;

end
$$;