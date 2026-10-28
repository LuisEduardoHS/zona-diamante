# Evidencia local de Prompt 3

Sin cuentas reales ni migraciones remotas. Cuenta de navegador sintética, Auth/FastAPI/PostgREST/PostgreSQL reales. Los swings de navegador los automatiza un helper de QA pulsando el botón visible, con reloj real; no modifica resultados ni deadlines.

- `database-clean-upgrade.txt`: aceptación final de dos stacks desechables, 406 pgTAP + 74 checks SQL beta + 48 escenarios concurrentes + 94 checks HTTP beta, además de regresión HTTP legacy/AR.
- `database-intento-inicial.txt`, `database-fixture-clock.txt`, `database-fixture-ledger.txt`, `database-fixture-user.txt`: intentos anteriores fallidos de las fixtures, conservados y explicados en el informe.
- `backend-tests.txt`, `frontend-tests.txt`, `build.txt`: resultados reales de suites/build finales.
- `victoria-oficial-respuesta-perdida.png`, `recorrido-oficial.txt`: primera victoria (+60), pérdida de respuesta después del commit y reintento estable; victorias posteriores y límite diario.
- `resultado-recuperado-segunda-pestana.png`: recuperación del cierre sin nuevo premio.
- `coleccion-saldo-250.png`, `compra-confirmada.png`, `coleccion-despues-recarga.png`, `segunda-pestana-inventario.png`: 190 de financiación local +60 ganados permitieron comprar la carta existente de 250; saldo posterior cero y carta persistente.
- `cuarta-partida-sin-premio.png`, `coleccion-final-120.png`, `saldo-compartido-final.json`, `browser-db-final.json`: tres premios de 60, cuarta victoria con cero; saldo final 190+180−250=120, una carta. Quinta partida abandonada sin premio.
- `pausa-oficial.png`, `abandono-oficial.png`: el plazo del pitch sigue en servidor y reanudar no crea otra partida.
- `regresion-invitado*.txt`: flujo local completo y navegación SPA/entradas.
- `consola-*.json`: capturas completas sin filtros. Oficial/directa/pausa/Colección sin entradas; invitado con un MutationObserver heredado del contexto de inspección, pendiente de contraste externo.

Las imágenes de Prompt 2 y su geometría responsive siguen en `../fase04/`. No equivalen a hardware móvil ni a pruebas de un despliegue. No hay tokens, claves privadas ni contraseña local en esta carpeta.
