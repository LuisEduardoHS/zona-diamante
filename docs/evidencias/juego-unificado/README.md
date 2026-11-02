# Evidencias del juego unificado

1 de noviembre de 2026 (America/Mexico_City). Todos los premios y compras
documentados aquí proceden de cuentas sintéticas en PostgreSQL/Auth/FastAPI
locales desechables. No son operaciones de producción.

Las imágenes JPG son capturas reales del navegador integrado. Las PNG de
referencia y el estadio provienen del usuario. Las imágenes del bateador se
conservaron idénticas; hashes en `assets-sha256.json`.

`portada`, `partida`, `hud-mitad`, `derrota` y `victoria-practica` usan el motor
real con reloj determinista inyectado por el servidor loopback de revisión.
`bonus-oficial`, `victoria-base-oficial`, `recuperacion-premio-65` y
`cupo-agotado` usan Auth/API/DB y reloj reales. El helper pulsa el botón real,
sin enviar resultados ni modificar estadísticas. `responsive.json` contiene
medidas DOM de los cinco tamaños, incluida la revisión de horizontal corregida.

`database.txt`: instalación limpia y upgrade, pgTAP, economía, concurrencia y
HTTP reales. Las fixtures SQL sólo desplazan deadlines en contenedores propios.
`browser-db-final.json` y `partidas-oficiales-db.json` son lecturas del ledger,
saldo y partidas sintéticas antes de cerrar ese stack. No incluyen credenciales.

Consola completa sin filtrar: `consola-completa.json`; corte anterior al terminar
la prueba oficial: `consola-oficial.json`. Se conserva el error histórico de
MutationObserver, sin afirmar que su origen haya quedado demostrado.

Arte definitivo pendiente: lanzador con varias poses y pelota transparente;
efectos y audio son opcionales. El lanzador y pelota actuales son provisionales.

Informe completo: [Fase 5](../../fase-05-juego-unificado.md).
