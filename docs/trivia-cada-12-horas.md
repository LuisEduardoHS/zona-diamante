# Renovación de trivia cada 12 horas

La trivia se renueva a las 00:00 y 12:00 en la zona configurada por
`TRIVIA_TIMEZONE` (actualmente `America/Monterrey`). No es una espera de doce
horas desde que el usuario termina: cada usuario tiene un intento por periodo.

Se mantienen los endpoints, pantallas, cinco preguntas, puntos por acierto,
guardado de respuestas y finalización idempotente. El cambio se limita al
periodo de disponibilidad y su renovación en la pantalla.

La migración `20261102000100_twelve_hour_trivia.sql` añade `trivia_slot`
(0: mañana, 1: tarde) a `daily_trivias`. La identidad única pasa de fecha a
fecha/periodo. Los registros previos se conservan en el periodo 0, junto con
sus preguntas, intentos, respuestas y premios. El RPC histórico con sólo fecha
sigue disponible y apunta al periodo 0; el backend actualizado selecciona
fecha y periodo usando su reloj, sin aceptar una elección libre del cliente.

`next_available_at` indica el próximo mediodía o medianoche. La pantalla
consulta de nuevo al servidor al llegar a esa hora, incluso si la fecha del
dispositivo sigue siendo la misma o éste usa otra zona horaria.

Validación local:

- 164 pruebas backend y 162 frontend; build completo correcto.
- Horarios 00:00, 11:59:59, 12:00 y 23:59:59, cambio de año y reloj UTC.
- Renovación al mediodía desde portada disponible y resultado completado,
  sin solicitudes duplicadas ni actualizaciones después de cerrar la pantalla.
- 20 comprobaciones SQL y 203 aserciones pgTAP en una base local desechable:
  preservación de datos al migrar, generación e intentos concurrentes,
  un premio por periodo, usuarios independientes y permisos privados.
- Auth/FastAPI/PostgREST reales locales: resolver mañana y tarde, bloqueo
  después de completar cada periodo, dos premios de 100 y reintentos sin
  duplicar el saldo. El reloj de periodo se controla sólo en esa prueba.

La migración se aplicó al proyecto Supabase remoto `zona-diamante` el
2 de noviembre de 2026, por solicitud del usuario. Se verificó el enlace
contra la configuración del backend/frontend, se respaldó el esquema público
en `.tmp/trivia-12h-migration/remote-public-before.sql` y el dry-run identificó
únicamente esta migración. La aplicación terminó correctamente, sin seeds ni
roles adicionales; las 26 versiones locales/remotas coinciden y no quedan
migraciones pendientes. Evidencia en `docs/evidencias/trivia-12-horas/`.
La consulta de metadatos de PostgREST confirmó que la columna `trivia_slot`
y el RPC con periodo ya son visibles. Esta verificación no creó intentos
ni acreditó premios en producción.

Para activar la renovación de doce horas todavía se debe desplegar el backend
actualizado y publicar el frontend. Esta operación sólo aplicó la migración;
no ejecutó un despliegue de la aplicación.
