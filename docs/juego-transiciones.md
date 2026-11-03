# Transiciones y respuesta visual del juego

Se añadieron fundidos al cambiar de pantalla y al abrir/cerrar la pausa,
entrada escalonada del resultado, conteo de puntos y saldo confirmados,
respuesta del marcador a hits/fallos, cuenta atrás animada, pulso de contacto,
resplandor breve al acertar y respuesta de los botones al presionarlos.

`game-motion.js` administra únicamente presentación: no avanza el reloj,
modifica estadísticas ni calcula premios. Al salir, los paneles pierden la
interacción inmediatamente (`inert`, `aria-hidden`) y terminan el fundido
antes de ocultarse. Alternar rápido cancela la animación anterior; una salida
vieja no puede ocultar el panel nuevo. Desmontar cancela efectos y fotogramas.

Los puntos se cuentan desde cero y el saldo desde el saldo confirmado anterior
al premio, conservando siempre la cifra final accesible. En práctica siguen
mostrándose guiones. El controlador sólo inicia esos contadores con un cierre
oficial confirmado por el servidor. No se modificó backend ni economía.

Las animaciones respetan `prefers-reduced-motion`, incluso si cambia durante
el conteo. Se usan opacidad y transformaciones; no se anima el desenfoque ni
se añaden retrasos a pausa, reanudación, bateo o red.

Validación: build completo y 167 pruebas frontend, incluidas cinco nuevas de
salida accesible, interrupción de pausa, precisión de cifras, desmontaje y
movimiento reducido. En navegador pasaron las 14 comprobaciones de mecánica
y 12 de movimiento con el motor real y reloj de QA; las animaciones usan el
reloj nativo. Las cifras sintéticas de demostración se prueban fuera del juego,
en un control exclusivo del servidor local de revisión.

Revisión visual en 390×844, 320×568 y 844×390, sin desbordamiento horizontal.
Evidencias: `docs/evidencias/juego-movimiento/`. La versión local normal se
prueba en el puerto 4190; el recorrido de movimiento en
`http://127.0.0.1:4191/__motion-review`. No se ejecutó un despliegue.
