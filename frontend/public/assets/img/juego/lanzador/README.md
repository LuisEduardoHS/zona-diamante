# Ilustraciones del lanzador

Recursos proporcionados por el propietario del proyecto: `zd-sultanes-L1.webp`
a `zd-sultanes-L4.webp`. La pelota se conserva en `../pelota-beisbjuego.webp`.

Las cuatro poses mantienen el lienzo original de 540 × 950 píxeles y su
transparencia. Los archivos recibidos eran WebP animados; L1 incluía un
fotograma vacío. Para que la pausa y el cambio de poses dependan únicamente
del reloj del juego, se guardó el primer fotograma de cada archivo como WebP
estático sin pérdida. Se verificó que sus píxeles RGBA coincidieran con el
primer fotograma original, conservando el perfil de color.

`data/game-beta-art.json` registra los recursos. `game-media.js` coordina la
preparación, el paso, la suelta y el seguimiento. Toda la secuencia comparte
escala y anclaje; la pelota comienza en la mano de L4 y llega al aro en el
tiempo de contacto del plan, también cuando aumenta la velocidad.
