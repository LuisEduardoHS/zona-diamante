# Fase 4 · Prompt 2 — Beta jugable del frontend

Fecha: 28 de octubre de 2026. Rama: `feat/game-beta-playable`. Base sin modificar: `dbc62123a0ac3519484f8e4759979c4a4926cd58`.

**Referencia histórica de Prompt 2.** El Prompt 3 integró después partidas oficiales y puntos reales en entornos locales aislados; su estado vigente y límites están en [fase-04-juego-beta-backend.md](fase-04-juego-beta-backend.md). Las afirmaciones de API pendiente y economía desactivada que siguen describen la entrega original de práctica, que continúa disponible sin premios.

**Implementado: juego completo de práctica local en ambas modalidades.** La validación autoritativa, persistencia de partidas beta y recompensas económicas corresponden al Prompt 3 y siguen desactivadas. Este informe complementa el [plan de Fase 4](fase-04-juego-beta-plan.md); no convierte sus propuestas de servidor en funcionalidades existentes.

## 1. Alcance y estado inicial

Se conservó el plan preexistente sin commit y la rama solicitada. La pantalla anterior era un prototipo: montaje/pausa/abandono y un resultado visual fijo, sin lanzamientos temporizados ni validación de bateo. Se sustituyó esa interfaz por inicio, modalidades, instrucciones, cuenta atrás, partida y resultado real de práctica. No se modificaron Colección, AR, trivia, sus economías ni migraciones históricas.

## 2. Reglas implementadas

| Modalidad | Límite | Victoria | Derrota |
| --- | --- | --- | --- |
| Clásica | 10 lanzamientos | Al menos 6 aciertos, evaluados después del décimo | Menos de 6 al terminar |
| Racha | Hasta 15 lanzamientos | 5 aciertos consecutivos; puede finalizar antes del límite | No lograr esa racha en 15 |

Perfecto cuenta como acierto y suma **20 puntos de partida en total**; bateo válido normal suma 10; fallo suma 0 y reinicia la racha. Los perfectos son un subconjunto de los aciertos. Temprano, tardío y no batear son fallos. No se decide el resultado al azar.

La configuración canónica está en `backend/app/core/game_beta_rules.json`. Es un archivo de datos preparado para reutilización futura; el backend actual todavía no lo consume. `frontend/scripts/generate-game-config.cjs` genera `public/data/game-beta-rules.json`, ignorado por Git, mediante una lista explícita de propiedades públicas. Fuerza `economy.enabled:false`; no lee secretos. Build, predev y preview generan el recurso.

Parámetros técnicos provisionales: cuenta atrás 3000 ms, vuelo 1400, contacto 1200, ventana válida ±150, perfecto ±50, feedback mínimo 600. Cada cinco lanzamientos cambian factores de velocidad `[1,.94,.88]`; dentro del bloque se repite `[1,.96,1.03,.98,1]`. Se escalan vuelo, contacto y ventanas juntos. Es progresión reproducible y ajustable en configuración, no una regla económica. Debe calibrarse con jugadores/dispositivos reales.

## 3. Arquitectura y ciclo de partida

| Archivo | Responsabilidad |
| --- | --- |
| `js/features/juego/game-state.js` | Funciones puras: validación, reglas, clasificación temporal, métricas y transiciones |
| `game-engine.js` | Reloj monotónico inyectable, un RAF, sincronización de entradas y cancelación por generación |
| `game-input.js` | Botón nativo para clic/toque y Espacio/Enter; repetición, formularios y diálogos |
| `game-media.js` | Precarga, manifiesto, poses, anclajes y trayectoria normalizada |
| `game-view.js` | Proyección DOM del estado; HUD, pelota, guía y dibujos |
| `game-session.js` | Adaptador explícito de práctica y récord opcional local por usuario/modalidad |
| `game-page.js` | Pantallas, controles, confirmaciones, Auth observado y ciclo de montaje/desmontaje |
| `ganar_juego.js` | Conserva el punto de entrada SPA `iniciarJuego(signal)` |
| `js/api/game-client.js` | Contrato futuro independiente, con fábrica sobre `solicitarBackend`; no se activa en práctica |

Flujo: `countdown → pitch → feedback → pitch … → finished`. Se puede pausar cuenta atrás, lanzamiento o feedback; reanudar vuelve a la fase y tiempo guardados. `abandoned` es terminal. La pantalla de victoria/derrota aparece después del último feedback y no al montar, pausar, salir o abrir Colección.

Se resuelve una sola acción por lanzamiento; en feedback el botón se desactiva. Una entrada que llega tras un bloqueo del hilo no se aplica al siguiente lanzamiento. RAF cancelados que lleguen tarde quedan invalidados por su generación. Reiniciar exige confirmación y crea ID/estadísticas nuevos. Cancelar reinicio/salida conserva la partida pausada. Salir confirmado abandona sin premio. También se contempla que sincronizar el reloj al pausar pueda terminar el último feedback: no se abre una confirmación sobre el resultado ya finalizado.

AbortSignal/desmontaje SPA cancela RAF, listeners, solicitudes, precarga y suscripciones. Ocultar el documento pausa. Cambio de identidad abandona la práctica anterior. Para restauración bfcache tras pagehide se solicita recarga, evitando revivir un motor destruido. La navegación SPA se comprobó en navegador; bfcache real y segundo plano de móviles quedan en la matriz física pendiente.

## 4. Dibujos y entidades

Se inspeccionaron los cuatro WebP suministrados y se copiaron **sin editar ni recomprimir** a `frontend/public/assets/img/juego/bateador/`. SHA-256 de cada copia coincide con el original: [hashes](evidencias/fase04/arte-original-hashes.json). Los cuatro tienen lienzo RGBA 540×950 y transparencia.

Secuencia: b1 reposo → b2 carga → b3 swing → b4 seguimiento → b1. El manifiesto `public/data/game-beta-art.json` contiene rutas, desplazamientos y tiempos. Los offsets son `(65,23)`, `(74,1)`, `(0,-1)`, `(0,0)` sobre el lienzo original; alinean el apoyo aproximado en `(336,929)` conservando idéntica escala. Las diferencias de postura son las del dibujo original, no deformaciones del motor. El contenedor centra ese anclaje en home y la pelota llega al arco del bate. No se generaron imágenes sustitutivas.

Lanzador geométrico CSS con brazo de lanzamiento, diamante SVG y campo CSS independientes del motor. Pelota circular proyectada desde el lanzador hacia el aro; después de acertar sale hacia arriba. El acierto se calcula por tiempo, no por píxeles del sprite. Cambiar tamaño sólo cambia la proyección; no altera tiempos ni estadísticas.

Precarga con error/timeout/cancelación; si falta un dibujo se usa otro disponible. Si faltan todos, aviso explícito y marcador provisional permiten continuar. Se probó ese escenario con respuestas 404 en el servidor local de revisión, sin borrar originales.

## 5. Interfaz y accesibilidad funcional

Inicio con récord de este dispositivo, selección Clásica/Racha, instrucciones, HUD, guía de contacto, feedback, pausa/reanudar, reinicio/salida confirmados y resultado con replay/cambio de modo/inicio. Se eliminó la carta de premio fija del prototipo. Puntuación de partida y puntos de cuenta se etiquetan por separado; en resultado se muestra `—` y recompensa **No disponible · práctica local**.

Botón Batear nativo, Espacio y Enter; evita repetición y el clic sintético de la misma tecla. No intercepta formularios, enlaces ni diálogos. Los controles principales miden al menos 44 px de alto; bateo 58 px en móvil y 76 en escritorio. Touch-action acotado a campo/bateo evita que un gesto sobre ellos desplace la página. Otras zonas pueden desplazarse para leer instrucciones/resultados.

CSS acotado a la página del juego. En 360×740 se redujo el campo a 180 px tras detectar que el botón quedaba demasiado cerca de la navegación inferior. En las cuatro medidas no hubo overflow horizontal y el botón principal quedó visible. Hay señales textuales además de colores. Movimiento reducido elimina animación de entrada, pulso de racha, desplazamiento al pulsar y transición del brazo; la trayectoria esencial de la pelota y los fotogramas necesarios para jugar permanecen. No se cambió la preferencia del sistema ni se certificó WCAG.

## 6. Servidor, seguridad y economía

No se crearon endpoints, tablas ni migraciones. Se mantienen intactas las rutas legacy, `activity_attempts`, `reward_events`, `profiles.points_balance`, inventario y la guarda SQL de Fase 2A.

El controlador usa sólo `createPracticeSession`. Su `complete()` ignora afirmaciones de victoria, score y puntos y devuelve `confirmedResult:null`, recompensa no disponible y valores económicos nulos. No consulta ni escribe premios/saldo/inventario. El récord de localStorage es manipulable, opcional y sin valor económico; no será evidencia para el backend ni se canjeará retrospectivamente. La práctica sigue funcionando si storage está bloqueado.

Contrato **preparado, no disponible en servidor**: `/api/v1/games/beta` para config, inicio por modalidad, lectura, siguiente pitch, swing, transición y cierre. Envía comandos y `expected_revision`, con `Idempotency-Key`; no envía score, victoria, premio, timestamp confiable ni identidad elegida por el cliente. `getGameServerClient()` importa el cliente HTTP existente de forma diferida; nadie lo invoca desde práctica. Antes de conectarlo se deben implementar/versionar DTOs, respuestas confirmadas, Auth/propiedad, reloj de servidor, deduplicación y protección concurrente. Los nombres de rutas son contratos propuestos, no compatibilidad prometida con una API inexistente.

La información económica prevista para usuario autenticado se lee de configuración y dice expresamente que no está disponible: 10 por completar y bonus 40/50 por victoria, hasta tres premiadas/día, conforme al plan. **No implementa ni activa esa entrega.** La práctica no usa un límite diario. Manipular JavaScript puede falsificar una práctica local; no genera un evento económico.

## 7. Pruebas ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `npm test` en frontend | **117/117**, 0 fallos/skips. Incluye 86 casos de `checks/` y 31 heredados locales de `tests/` ignorado. |
| Sólo archivos `checks/*.test.mjs` | **86/86**; permite verificar la suite versionable sin los casos locales heredados. |
| Casos nuevos de beta | **27** añadidos en `checks/game-beta.test.mjs`; las seis comprobaciones del prototipo en `juego.test.mjs` se adaptaron al motor real y sus invariantes. |
| `venv/Scripts/python.exe -m pytest -q -p no:cacheprovider` en backend | **118/118**, una advertencia heredada Starlette/TestClient sobre HTTPX. No se instalaron paquetes para silenciarla. |
| `npm run build` | Aprobado: config de juego, Tailwind, bundle Supabase y runtime config público. |
| `git diff --check` | Sin errores de espacios. |
| Navegador, página directa con reloj real | Inicio, cuenta atrás, teclado y clic producen fallo temprano verificable, pausa/reanudación, partida de 10 lanzamientos termina en derrota; consola capturada sin entradas. |
| Navegador, interfaz/motor reales con reloj determinista inyectado | Recorrido con victoria/derrota de ambos modos, normal/perfecto/temprano/tardío/timeout, duplicación, reinicio, cancelación, replay, abandono y premio no disponible. |
| Entradas y navegación SPA | Formulario no interceptado, Space una vez, repetición ignorada, botón nativo, pausa, desmontaje y reentrada limpia: 7 aserciones aprobadas. |
| Destrucción | 3 aserciones aprobadas: RAF cancelado, abandono y sin callbacks/acciones residuales. |
| Responsive | 360×740, 390×844, 768×1024, 1440×900; DOM y capturas, cuatro recursos cargados en cada medida, sin overflow horizontal. |
| Recursos ausentes | Cuatro 404 controlados: aviso y placeholder, lanzamiento/bateo/pausa siguen funcionando; consola capturada sin entradas JavaScript. |
| Originales | Cuatro SHA-256 idénticos, RGBA/transparencia conservados. |

Las unitarias cubren fronteras inclusivas exactas, puntuación, reinicio, estados inválidos/terminales, cancelación/timeout, callbacks antiguos, hilo bloqueado, progreso determinista y ausencia de premios. Los recorridos deterministas no sustituyen medir habilidad humana, latencia o hardware.

## 8. Herramientas reproducibles y evidencia

Con dependencias ya instaladas, desde `frontend`:

```powershell
npm run build
npm test
npm run preview:game
```

Servidor sólo loopback: `http://127.0.0.1:4190/pages/experiencias/juego.html` usa RAF/performance.now reales; `http://127.0.0.1:4191/__review` contiene controles de recorrido determinista, cuatro poses, entradas/SPA y limpieza. Ambos sirven módulos/HTML/CSS originales y sustituyen Auth **sólo en el servidor de pruebas** por invitado; no leen cuentas reales. 4191 sustituye el punto de entrada con un reloj inyectado. No hay flags de victoria ni rutas de QA en producto publicado. El servidor rechaza API con 501 y no se conecta a Supabase. No debe publicarse este servidor de revisión.

La página directa con `?missing` activa únicamente en ese servidor una prueba de arte ausente. Cerrar/reabrir o recargar la revisión antes de ejecutar controles después de «Comprobar limpieza», que destruye deliberadamente la instancia. La evidencia de este recorrido está en `docs/evidencias/fase04/`: capturas de cuatro viewports, cuatro poses, modalidades, resultado real, fallback, geometría JSON, hashes, stdout y registros de consola. Las capturas con cabecera «Fixture local» llevan reloj controlado; las de juego/resultado directo usan reloj real. Ninguna corresponde a un teléfono físico.

## 9. Consola y errores observados

Página directa con reloj real: `consola-reloj-real.json` contiene `[]`. Escenario negativo de arte: `consola-recursos-ausentes.json` contiene `[]`; los HTTP 404 esperados se manejan por precarga y aviso, no se ocultan errores de consola.

Revisión final con iframe: `consola-fixture-final.json` conserva **dos entradas acumuladas** de `TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'`, una al abrir la pestaña y otra al recargar para verificar los últimos cambios. No hay MutationObserver en los módulos nuevos del juego. La investigación previa de Fase 2B reprodujo ese error en iframes sin scripts y apunta al entorno de inspección; no se obtuvo ahora una pila que permita atribuir estos eventos concretos. Véase [investigación del observer](fase-02b-validacion-observer.md). No se parchearon librerías ni se filtró/suprimió consola. No se declara limpia la consola de la revisión con iframe.

Durante el primer recorrido falló además una aserción de la herramienta de QA al consultar `last.type` después de avanzar al siguiente lanzamiento, donde `last` se limpia correctamente. Se corrigió el helper para guardar el resultado antes de avanzar. No era un fallo del motor. Los registros inicial/histórico se conservan; una pestaña nueva ejecutó la revisión final sin ese error. Separar archivos por ejecución no borra el historial anterior.

## 10. Pendientes y límites de aprobación

- Prompt 3: servidor autoritativo y persistencia beta, fuente temporal/participación defendible, anticarreras/antifarming, cuotas y entrega económica idempotente. Ninguna práctica anterior se premia retrospectivamente.
- Integración Auth real y respuestas económicas reales, red interrumpida/reintentos y varias pestañas contra servidor; esta etapa no las simula como aprobadas.
- Chrome externo y Safari/iOS/Android físicos: tacto real, DPR/safe areas, orientación, rendimiento, segundo plano y bfcache; verificar también movimiento reducido habilitado y pila del observer si reaparece. Las cuatro medidas actuales son viewports del navegador integrado.
- Calibración de dificultad/ventanas, suavidad de las cuatro poses originales y legibilidad con usuarios; son parámetros/artes provisionales.
- No se ejecutaron Docker ni pruebas SQL en esta etapa porque no cambió SQL ni persistencia. Las pruebas SQL de fases anteriores son antecedentes, no nuevas ejecuciones.
- No se verificaron despliegues remotos ni se certificó producción.

## 11. Checklist de esta entrega

- [x] Juego de práctica completo de principio a fin, en Clásica y Racha.
- [x] Resultado depende de acciones temporales y reglas; ningún botón produce victoria directamente.
- [x] Cuatro dibujos originales con escala/anclaje compartidos; fallback probado.
- [x] Geometría provisional de campo/lanzador y pelota separados del motor.
- [x] Pausa, reanudar, reiniciar, abandonar, terminales y deduplicación comprobados.
- [x] Puntuación/racha/replay y récord local sin saldo ni premios ficticios.
- [x] Contrato futuro separado y adaptador local explícito; guardas económicas conservadas.
- [x] Suites frontend/backend y build aprobados; recorridos reales y deterministas diferenciados.
- [x] Cuatro viewports y navegación SPA comprobados; evidencias y consola conservadas.
- [ ] Matriz física/externa y observer del contexto de inspección pendientes.
- [ ] Servidor beta/recompensas/aceptación extremo a extremo pendientes de Prompt 3.

**Recomendación:** continuar revisión e integración local del frontend y comenzar el Prompt 3. La beta económica y la aprobación de producción siguen pendientes. No se hicieron commits, push, merge, cambios de rama, instalaciones, despliegues, migraciones remotas ni operaciones sobre usuarios reales.
