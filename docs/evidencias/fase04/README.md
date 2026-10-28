# Evidencia de Prompt 2 · Fase 4

Todos los recorridos son locales, invitado y sin premios. Las capturas no son fotografías de dispositivos físicos.

- `juego-*`, `modalidades.png`, `resultado-reloj-real.png`: página de producto con RAF/reloj real, servidor de revisión 4190. `viewports.json` registra medidas DOM y recursos; no hubo overflow horizontal.
- `pose-*`: módulos/interfaz reales dentro de la revisión 4191, reloj determinista inyectado, cuatro poses sin modificar los originales. La cabecera de la fixture identifica la simulación temporal.
- `recorrido-interfaz.txt`, `entradas-spa.txt`, `limpieza.txt`: aserciones de DOM/motor en ese navegador, no resultados de servidor económico.
- `sin-recursos.png`: escenario negativo explícito del servidor de QA que responde 404 para los cuatro sprites; el motor continúa con placeholder.
- `entradas-reloj-real.json`: Espacio y clic produjeron fallo temprano, sin alterar el reloj.
- `arte-original-hashes.json`: SHA-256 iguales entre los cuatro adjuntos originales y sus copias en el proyecto.
- `frontend-checks.txt`: suite de archivos de checks reproducible sin tests locales ignorados; `frontend-tests.txt`: runner completo local.
- Consolas completas separadas por ejecución: directa, escenario negativo, primera revisión/histórico y revisión final nueva. La revisión con iframe conserva el TypeError de MutationObserver; no se suprimió. El fallo inicial del helper de QA sobre `last.type` se corrigió antes de la ejecución final. Consultar el informe principal para contexto/límites.

Reproducir: `npm run preview:game` desde frontend; abrir 4190 para jugar y 4191 `/__review` para los recorridos. No publicar el servidor de pruebas. No se activaron cuentas reales, cámara ni APIs económicas.
