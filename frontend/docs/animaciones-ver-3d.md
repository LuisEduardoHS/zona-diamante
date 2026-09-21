# Entradas de Ver 3D

Las entradas transforman el modelo completo. No editan sus archivos GLB ni necesitan un esqueleto o animaciones incluidas en el modelo.

## Las cuatro entradas

| Entrada | Duración | Movimiento |
| --- | --- | --- |
| Caída con rebote | 1,35 s | Baja desde arriba, se comprime suavemente al aterrizar y hace dos rebotes cada vez más pequeños. |
| Llegada rodando | 1,25 s | Entra por la izquierda mientras gira sobre su centro; se pasa ligeramente y vuelve al centro. |
| Acercamiento | 1,15 s | Parte desde el fondo, se acerca con un pequeño giro y termina con un ajuste de tamaño. |
| Llegada a saltos | 1,50 s | Avanza desde la derecha en dos saltos, amortigua la llegada y se acomoda. |

Cada apertura elige aleatoriamente entre las entradas disponibles, excluyendo la última utilizada durante esa sesión del visor. El sorteo es independiente del equipo.

## Cómo se calculan

`public/js/entradas-modelo.js` contiene las duraciones, los pasos y el controlador del tiempo. Cada paso usa `t` entre 0 y 1:

- `x` e `y`: fracciones del ancho y alto visibles a la distancia del modelo. Así se adaptan a diferentes pantallas y tamaños de GLB.
- `z`: desplazamiento en profundidad, relativo a la distancia normal de la cámara. Los valores negativos alejan el modelo.
- `rx`, `ry`, `rz`: giros en grados sobre cada eje.
- `sx`, `sy`, `sz`: multiplicadores de tamaño. El valor 1 conserva la escala. Los pequeños cambios de proporción simulan la amortiguación al aterrizar.
- `curva`: cómo se llega a ese paso desde el anterior. `acelerar` simula una caída; `frenar` suaviza una subida o llegada; `suave` permite acomodarse sin saltos.

`requestAnimationFrame` actualiza el movimiento según el tiempo transcurrido, no contando fotogramas. Una pantalla de 60 Hz y otra de 120 Hz conservan la misma duración.

`public/js/camara.js` aplica cada pose al encuadre existente. Compensa el centro geométrico después de escalar y girar, especialmente importante para Algodoneros, cuyo origen está desplazado. No recalcula toda la geometría en cada fotograma: reutiliza el centro y el tamaño obtenidos al abrir el visor.

## Finalización e interrupciones

- Al finalizar, restablece exactamente los desplazamientos y giros a cero y los multiplicadores a uno. Se detiene el bucle de animación y quedan disponibles los gestos y la foto.
- Durante la entrada se ignoran los gestos y se oculta la captura; cerrar sigue disponible.
- Cerrar cancela la animación pendiente. Reabrir empieza una entrada nueva; un callback antiguo no puede modificarla.
- Pasar a segundo plano termina la entrada para que, al volver, el modelo esté listo para manipularse.
- Cambiar la orientación recalcula el encuadre y conserva el progreso de la entrada.
- Con la preferencia de movimiento reducido del dispositivo, el modelo aparece directamente en su posición final.

## Pruebas

`npm test` valida continuidad, escalas válidas, finalización exacta, cancelación, callbacks antiguos y movimiento reducido.

Con `npm run preview:foto`, abrir `http://127.0.0.1:4173/__entradas-review`. Permite revisar las entradas y ejecutar las 12 combinaciones de los tres modelos disponibles. La prueba utiliza A-Frame, los GLB y `camara.js` reales; simula únicamente la cámara y los eventos de detección. También comprueba gestos, captura después de animar y cierre a mitad de la entrada.

Esta prueba no sustituye comprobar el seguimiento de logos y el rendimiento de cámara en el teléfono real.
