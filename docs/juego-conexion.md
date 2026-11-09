# Juego y conexión

El juego usa `/api/v1/games/buffered`: requiere una conexión inicial para
reservar una partida de la cuenta, pero los lanzamientos, bateos y pausas
corren en el dispositivo. No mide la latencia para permitir jugar ni consulta
al servidor por cada tiro. El protocolo anterior `/games/beta` se conserva
para compatibilidad; la página del juego ya no lo usa.

Al terminar se envía la secuencia de entradas `{pitch, at_ms}`. Un valor nulo
significa que no hubo bateo. El servidor reproduce los lanzamientos con sus
reglas, verifica su orden, los tres fallos y una duración mínima total, y
calcula el resultado y los puntos. El cliente no puede enviar un balance ni
elegir el premio. Se mantienen el máximo de 65 puntos por victoria, las tres
partidas premiadas por día y el límite de 30 reservas por hora.

La reserva y las entradas se guardan en `localStorage`, separadas por cuenta.
Una partida en curso se recupera pausada; los resultados pendientes se
reintentan al volver la conexión, al regresar a la página o desde el botón
«Reintentar puntos». El sincronizador funciona también fuera de Juego, en
las demás secciones. Una respuesta perdida reenvía el mismo identificador y
las mismas entradas: la transacción y la clave única del historial evitan
premios duplicados. Solo se muestra un premio acreditado después de recibir
la confirmación del servidor.

Las reservas vencen a las 48 horas. Para recuperar entradas todavía no
sincronizadas se necesita la misma cuenta y el mismo navegador, conservando
sus datos locales. El servidor valida la reproducción y los límites de la
economía, pero los tiempos registrados en el dispositivo no certifican que
una persona haya realizado las entradas; este protocolo no es un sistema
contra clientes modificados.

## Instalación y comprobaciones

Aplicar `supabase/migrations/20261108000500_buffered_batting_games.sql` antes
de publicar el backend y el frontend. Las RPC son exclusivas de
`service_role`; el backend obtiene el usuario del JWT y usa reglas propias.

- `npm test --prefix frontend`: motor, persistencia y reintentos.
- `backend/venv/Scripts/python.exe -m pytest backend/tests`: contratos del API.
- `backend/venv/Scripts/python.exe backend/checks/check_game_buffered_database.py --linked`:
  reproducción y premios con el rol real de servicio, dentro de una
  transacción revertida. Agregar `--with-migration` permite verificar la
  migración antes de aplicarla.
- `frontend/checks/game-buffered-browser.cjs`: página real y navegación SPA
  con cuenta y red simuladas; incluye latencia de 1,2 segundos, pérdida de
  conexión, recarga y respuesta perdida después de acreditar. Requiere
  Playwright, Edge y un frontend local; admite `PLAYWRIGHT_MODULE` y
  `MATCHES_FRONTEND`.
