# Fase 4 — Beta funcional del minijuego de béisbol

Fecha: 28 de octubre de 2026, America/Mexico_City.

**Etapas 1–3 implementadas y verificadas localmente.** La auditoría original conserva su contexto histórico. Prompt 2 está en [fase-04-juego-beta-frontend.md](fase-04-juego-beta-frontend.md); Prompt 3 integra servidor, persistencia y puntos con validación local en [fase-04-juego-beta-backend.md](fase-04-juego-beta-backend.md). La práctica sigue sin premios; la economía oficial nueva sólo se ejecutó en bases locales desechables. Publicación y aceptación física/producción siguen pendientes del Prompt 4.

## 1. Git, alcance y evidencia de esta etapa

Se ejecutaron `git status --short`, `git log -5 --oneline`, `git fetch origin` y la lectura de HEAD de `main`/`origin/main`. Ambos apuntaban a `dbc62123a0ac3519484f8e4759979c4a4926cd58`. No había cambios locales que preservar. El aviso de acceso a `.pytest_cache/` ya existía; no se borró ni se modificó esa carpeta.

Se creó **`feat/game-beta-playable`** directamente desde ese `main`. El nombre estaba disponible. No se hizo reset, commit, push, merge ni despliegue. El único archivo nuevo de esta etapa es este informe. No se modificó código de producto, SQL, configuración ni dependencias.

Se leyó el informe de Fase 3, el de Fase 2A, las secciones de juego/recompensas de la auditoría general y del plan original de Supabase, y se contrastaron con fuentes y pruebas actuales. Los estados de Netlify/Render de Fase 3 son antecedentes: **no se revalidaron despliegues ni se consultó Supabase remoto en este Prompt 1**.

### Archivos contrastados

| Área | Archivos / símbolos principales |
| --- | --- |
| Pantalla | `frontend/public/pages/experiencias/juego.html`, `frontend/public/css/juego-Style.css` |
| Estado local | `frontend/public/js/features/juego/ganar_juego.js`: `crearEstadoJuego`, `iniciarJuego` |
| Animación auxiliar | `frontend/public/js/features/juego/confeti.js`: `lanzarConfeti` |
| Montaje SPA | `frontend/public/js/app/navegacion.js`: rama `RUTAS.juego`, AbortController de sección |
| Auth / HTTP | `frontend/public/js/features/auth/{service,session,guards,supabase-provider}.js`, `js/api/backend-client.js`; `backend/app/core/security.py` |
| API de sesiones | `backend/app/api/routes/games.py`, `app/schemas/game.py`, `app/services/games.py` |
| Intentos genéricos / economía | `app/api/routes/attempts.py`, `app/services/{attempts,rewards,cards,trivia}.py`, esquemas de intentos/cartas |
| SQL | `20261024000100_isolate_reward_idempotency.sql`, `20261025000100_game_attempt_lifecycle.sql`, `20261025000200_verified_ar_mascot_grants.sql`; esquema original de intentos/recompensas |
| Pruebas | `frontend/checks/juego.test.mjs`, `backend/tests/test_games.py`, `supabase/tests/database/phase02a_game_test.sql`, `backend/checks/phase02a_database.py`, regresiones de Fases 1–3 |

La búsqueda de reglas abarcó el repositorio de texto, excluyendo dependencias, bundles, temporales y evidencias repetidas. No aparecieron otra página/controlador de minijuego ni definiciones previas de Clásica/Racha, ventanas de golpe o sus recompensas. Las menciones deportivas a rachas en fichas/trivia no son reglas del minijuego.

## 2. Auditoría del estado anterior

| Elemento | Estado confirmado en código |
| --- | --- |
| Acceso al juego | Ruta pública y navegación SPA funcionales; no exige login. |
| Inicio | Montar la sección crea inmediatamente un estado local `active`; no hay botón Comenzar ni preparación de una ronda. |
| Modalidades | No existen selector, configuración ni lógica por modo. |
| Instrucciones | Sólo el texto estático «Toca la pantalla para batear». No hay pantalla de instrucciones. |
| Campo, bateador, lanzador y pelota | Una sola imagen rasterizada; no son entidades de un motor. |
| Lanzamientos / bateo | No hay temporizador de lanzamiento, trayectoria, zona de contacto, detección de golpe o listener de bateo. Tocar la imagen no juega. |
| Cuenta regresiva / reloj | No existen. El selector CSS `.timer` no se usa en el HTML y no demuestra un temporizador funcional. |
| Puntuación / racha / aciertos / fallos | No existen contadores ni actualización de estadísticas. |
| Victoria / derrota | No existe ninguna condición real ni finalización de partida. |
| Pausa / reanudación | Cambia el estado local y `aria-label`/`aria-pressed` del botón. No hay simulación cuyo tiempo se congele. |
| Salida / reinicio | La cancelación SPA abandona la instancia local y retira el listener. Reentrar crea otra limpia; no hay control explícito Volver a jugar. |
| Resultado visual | Overlay oculto con «¡Ganaste!», imagen Dorados y «Jesús Loya… Carta 2 de 4». Es contenido de demostración, ajeno al inventario actual. El montaje elimina `activo`. |
| Confeti | Existe un módulo con animaciones y movimiento reducido. No se encontró ningún consumidor actual en `frontend/public/js`; no es un motor ni prueba de victoria. |
| Auth / backend del frontend | El controlador del juego no importa cliente HTTP ni sesión y no llama a `/api/v1/games`. La pausa/salida no persisten una sesión en servidor. |
| Recompensas | El frontend no concede saldo ni cartas. Las sesiones administradas del servidor tienen premios bloqueados. |

`crearEstadoJuego()` permite `active ↔ paused → abandoned`; abandonar es terminal e idempotente. `iniciarJuego(signal)` usa WeakMap para evitar doble montaje del mismo nodo, detiene la propagación del clic de pausa y limpia el resultado de demostración. No se debe reintroducir el antiguo fallo de ganar con cualquier clic.

El CSS conserva selectores de apariencia no usados (`.juego-top`, `.timer`, `.question-card`, `.question-image`) y una regla global `body`. Son deuda para revisar al implementar la pantalla, no mecánicas existentes. La pausa actual mide 40×40 px: la beta deberá ampliar el área táctil sin afectar otras secciones.

### Recursos gráficos disponibles

- `assets/img/juego/boceto-PI.webp` (38 266 bytes), con PNG fuente de 1080×1920: se inspeccionó visualmente. Integra lanzador, pelota, bate y bateador en el mismo dibujo. No hay sprites separados ni fotogramas de animación. No sirve como motor ni conviene superponer una segunda pelota sobre la que ya contiene.
- `assets/img/juego/collect.webp` (6 600 bytes), con PNG de 1082×892: icono del acceso a Colección.
- `assets/img/trivia/pelota-beis.webp`: recurso de pelota reutilizable si su recorte/resolución encajan; no equivale a un sprite animado ya preparado.
- `assets/img/Cartas/{DoradosC,CharrosC,SultanesC,AlgodonerosC}.webp`: recursos estáticos anteriores. Ninguno acredita que una carta haya sido adquirida.
- Urbanist y colores de plataforma disponibles. No se encontraron recursos de campo/bate/lanzador separados específicos del juego. La beta puede construir el campo y figuras sencillas con HTML/CSS/SVG; no necesita otro framework ni dependencias por defecto.

El resultado de beta reemplazará la promesa fija de carta por las estadísticas reales de la partida. Colección seguirá resolviendo propiedad en servidor; no habrá una carta fija entregada por ganar.

## 3. Infraestructura que sí se reutiliza

### Contrato actual, aún sin beta

| Endpoint existente | Comportamiento actual |
| --- | --- |
| POST `/api/v1/games` | JWT + `Idempotency-Key`; cuerpo `{}` o `{restart_of: UUID}`. Devuelve 200 y UUID emitido por BD. La misma clave recupera la misma sesión. |
| GET `/api/v1/games/{id}` | Sólo intento administrado propio; ajeno/inexistente devuelve 404. |
| POST `/api/v1/games/{id}/transitions` | `pause/resume/abandon` y revisión entera estricta. Reintento exacto no incrementa dos veces; conflicto 409. |

`GameStart` prohíbe campos extra, incluida hoy la modalidad. `GameRead` sólo admite `active/paused/abandoned` y `rewards_enabled: false`. No hay endpoint de lanzamientos, golpes, configuración de juego o finalización económica. Se confirmó también instanciando los esquemas: modo en inicio, acción `win` y `rewards_enabled:true` son rechazados.

Persistencia: `activity_attempts` ya tiene `game_state`, `game_revision`, `game_request_key`, `game_parent_id`. Hay unicidad por usuario/solicitud y por origen de reinicio. Las RPC de inicio/reinicio y transición bloquean filas, verifican pertenencia y revisión; inicio/reinicio toma perfil antes que intento.

La restricción **`managed_game_shape` exige `score IS NULL`** y sólo permite estados administrados activos/pausados o abandonados. El trigger **`block_unvalidated_game_reward` rechaza cualquier evento asociado a un intento administrado**, incluso por cero puntos. Por tanto, no basta agregar un endpoint Python de «finish»: el esquema impide deliberadamente premiarlo.

Se reutilizarán Supabase Auth, `get_current_user`, cliente REST privilegiado de backend, `profiles.points_balance`, `reward_events`, `reward_operation_key` y las garantías de Fase 1. El índice `reward_events_v2_attempt_resource_idx` ya limita a un evento v2 por intento. Base y bono se deberán sumar en **un solo evento**, no en dos entregas independientes.

`POST /api/v1/attempts` puede crear intentos genéricos `game` con metadata, pero eso no los valida ni los convierte en sesiones administradas. No se usará como atajo para premiar un resultado del navegador. La función económica genérica es privilegiada y no tiene un endpoint público de finalización; sus pruebas históricas con `game_win`, score 1 y 20 puntos son fixtures de integridad, **no reglas de producto**.

## 4. Reglas recuperadas y decisiones provisionales

Se conservan las reglas existentes de seguridad, pertenencia, revisiones, reintentos y abandono terminal. El plan original de backend enumera la definición de victoria y cuotas como decisiones pendientes; sus sugerencias de nonce/tiempos no sustituyen validación autoritativa. No se encontraron cantidades de lanzamientos, objetivos o premios de juego que contradigan las propuestas del nuevo prompt.

Se adoptan **para la planificación de beta**, con versión y configuración de backend, estos valores proporcionados por el usuario:

| Parámetro | Clásica (`classic`) | Racha (`streak`) |
| --- | --- | --- |
| Lanzamientos | Exactamente 10 para completar | Hasta 15 |
| Victoria | Al terminar los 10, al menos 6 aciertos | En cuanto se alcanzan 5 aciertos consecutivos |
| Derrota | Al terminar los 10 sin llegar a 6 | Al resolver el lanzamiento 15 sin alcanzar la racha de 5 |
| Fallo | Consume un lanzamiento | Consume un lanzamiento y reinicia racha actual |
| Bono económico de victoria | 40 | 50 |

Puntuación **interna**: acierto normal 10, perfecto 20, fallo 0. Un perfecto cuenta como **un acierto** y un paso de racha; otorga 20 en total, no 10+20. Registrar lanzamientos resueltos, aciertos, fallos, perfectos, racha actual, racha máxima y score. Aciertos+fallos debe coincidir con lanzamientos resueltos; perfectos es subconjunto de aciertos. La racha estadística mide aciertos consecutivos en ambos modos: todo fallo reinicia la actual y no disminuye la máxima; sólo Racha la usa como condición de victoria.

No se acaba Clásica antes del décimo lanzamiento aunque ya tenga seis aciertos. No se pierde Racha anticipadamente por una estimación matemática: se usa el máximo indicado. Agotar el tiempo de un lanzamiento sin batear produce un fallo único. No se agregan vidas, innings, faltas, equipos con ventajas, cartas premiadas o niveles no solicitados.

### Economía prevista, aún deshabilitada

- Finalización legítima validada: 10 puntos; victoria Clásica total **50**; victoria Racha total **60**; derrota legítimamente completada **10**.
- Máximo **tres partidas premiadas por usuario/día**, compartido por ambos modos. Los juegos adicionales siguen disponibles, con premio 0 y motivo `daily_limit`.
- Abandono, expiración, práctica local y resultados inválidos no entregan puntos ni consumen una plaza premiada.
- Score interno y saldo económico son magnitudes distintas. Una Clásica con seis aciertos, dos de ellos perfectos, tiene score 80; si es válida y elegible, su premio sería 50, no 80.
- Racha con los cinco primeros golpes perfectos tiene score 100 y victoria temprana; su premio sería 60 si es elegible. Una cuarta partida válida del día sigue registrando su resultado, sin crédito.
- Hasta 180 puntos diarios por juego con estos parámetros; no se cambian costos de colección ni reglas de trivia para compensarlo.

**Qué significa «legítimamente completada» sigue necesitando una política de participación y abuso.** Resolver diez o quince timeouts en servidor no acredita que alguien jugó. No se inventa un mínimo de aciertos, una tarea extra o un simple temporizador como prueba de presencia. Ese punto debe quedar resuelto y probado antes de habilitar los 10 puntos de participación. La beta jugable puede avanzar con premios desactivados.

### Una fuente de configuración

Propuesta para Prompt 2: `backend/app/core/game_beta_rules.json`, con versión, modos, puntuación interna, tiempos y economía; validado por backend cuando se integre. El frontend recibe la proyección pública, sin secretos, mediante un GET de configuración. Para práctica sin API, un script de build puede generar una copia pública **desde ese mismo archivo**, nunca mantener otra lista manual de números. El artefacto debe marcar práctica y no habilitar premios.

Los tiempos que faltan se ensayarán como **decisión técnica provisional**, no regla histórica: cuenta atrás 3 segundos, vuelo 1 400 ms, contacto a 1 200 ms, ventana válida ±150 ms, perfecta ±50 ms y feedback entre lanzamientos 600 ms. Son valores de arranque sujetos a pruebas de teléfono/red; todos viven en configuración, no dispersos en handlers o CSS. Los extremos se especificarán inclusivos y el perfecto tendrá precedencia dentro de la ventana válida.

La versión/snapshot de reglas se fija al iniciar cada partida; un cambio de configuración no modifica una en curso. El cliente nunca elige el premio ni entrega su propia configuración para autorizarlo. Flag de backend `rewards_enabled` inicialmente falso; activación económica sólo después de validación/SQL/pruebas, no por cambiar un booleano en JS.

Para cuota diaria se propone `America/Mexico_City`, como decisión provisional explícita. El código actual configura **trivia** con `America/Monterrey`; no se cambia esa actividad ni se supone que una zona implique la regla del juego. Backend/SQL deben usar la misma política y fecha de finalización canónica; reloj y zona del teléfono no tienen autoridad.

## 5. Estados y flujo completo previsto

### Presentación / motor local

```text
selección → instrucciones → preparando → cuenta_regresiva
    → lanzamiento → feedback → entre_lanzamientos → lanzamiento …
    → resultado_ganado | resultado_perdido
    → volver_a_jugar → selección / nueva partida

cuenta_regresiva/lanzamiento/feedback/entre_lanzamientos ↔ pausado
cualquier fase no terminal → abandonado
```

Se guarda la fase y el tiempo restante al pausar práctica. Reanudar no crea otra instancia ni dispara cuenta atrás duplicada. Resultado ganado/perdido/abandonado es terminal: ignora golpes, ticks y callbacks antiguos. Reiniciar usa otro ID y limpia contador, racha, score, inputs y resultado. La pantalla de resultado muestra estadísticas de esa partida, no el overlay de carta del boceto.

### Sesión de servidor y premio, separados

Sesión beta propuesta: `created → active ↔ paused → completed`, con `outcome=won|lost`; también `abandoned/expired` terminales sin premio. Las fases de animación no necesitan convertirse en todos esos estados SQL. El cierre de partida no debe confundirse con la entrega económica.

Premio: `disabled | pending | granted | daily_limit | rejected`; el cliente puede además estar en `uncertain` si perdió una respuesta. Sólo el servidor confirma `granted`, importe y saldo. Un GET/reintento reconcilia; no se inventa un nuevo resultado ni una segunda entrega.

### Recorrido del usuario

1. Elige Clásica/Racha; ve objetivo y controles breves.
2. Invitado puede practicar; autenticado también estará en práctica mientras no esté listo el protocolo premiable. Iniciar sesión tras jugar localmente no permite reclamar esa partida retrospectivamente.
3. Comenzar crea una sola partida, espera configuración válida y entra en cuenta regresiva.
4. Cada lanzamiento presenta pelota separada del fondo y una referencia de contacto. Clic/tap o Espacio/Enter en el control de bateo generan una acción; no se escucha indiscriminadamente cualquier clic del documento.
5. Sólo se acepta un intento de bateo por lanzamiento. Una acción temprana/tardía en un lanzamiento activo se considera fallo; pulsar durante cuenta atrás, pausa, feedback o resultado no cambia métricas. No se cuentan clic sintético adicional, key-repeat o propagación desde Pausar/Colección como otro golpe.
6. Se clasifica fallo/normal/perfecto, actualiza métricas y comprueba el objetivo en el momento correspondiente al modo. Dibujo y reglas tienen relojes separados del número de frames.
7. Tras feedback se solicita/prepara el siguiente lanzamiento, o muestra resultado terminal.
8. En modalidad premiable, el cierre exige resultado derivado de acciones registradas en servidor. Se espera confirmación económica antes de mostrar puntos recibidos. Cuota agotada permite volver a jugar; no es un error de partida.
9. Volver a jugar crea una nueva operación con nueva clave; reintentar una respuesta incierta usa la clave original.

Pausa de **práctica** congela el reloj de simulación. Para una partida premiable se propone permitir pausa entre lanzamientos: si se solicita durante un vuelo, ese lanzamiento conserva su deadline, se resuelve y luego se pausa. No se ofrece congelar la ventana económica indefinidamente. El servidor controla esa política; la API legacy conserva su pausa inmediata. Ocultar la pestaña detiene renderizado; al volver se reconcilia, sin inventar aciertos ni prolongar un plazo del servidor.

## 6. Arquitectura de archivos prevista

**Rutas propuestas, no creadas todavía:**

```text
frontend/public/pages/experiencias/juego.html       # modalidad/instrucciones/partida/resultado
frontend/public/css/juego-Style.css                # selectores acotados a juego
frontend/public/js/features/juego/
  ganar_juego.js                                  # entrada compatible iniciarJuego(signal)
  game-state.js                                  # reducer/estados/estadísticas puros
  game-engine.js                                 # reloj, fases, un lanzamiento activo
  game-input.js                                  # pointer/teclado, deduplicación
  game-view.js                                   # HUD, campo, pelota, resultado y animación
  game-session.js                                # sincronización y recuperación del servidor
frontend/public/js/api/game-client.js             # adaptador del backend-client existente
backend/app/core/game_beta_rules.json             # única configuración versionada
backend/app/schemas/game_beta.py                  # DTOs estrictos independientes del legado
backend/app/services/game_beta.py                 # coordinación y validación autoritativa
backend/app/api/routes/game_beta.py               # endpoints beta, Auth existente
supabase/migrations/<nueva_version>_game_beta.sql  # sólo en etapa de persistencia
frontend/checks/game-beta*.test.mjs
backend/tests/test_game_beta.py
supabase/tests/database/phase04_game_beta_test.sql
backend/checks/phase04_database.py                # reutilizar runners locales desechables
```

Los nombres se pueden ajustar a lo que necesite la implementación; no son compromiso de crear archivos vacíos o duplicar funciones. Se preserva el punto de montaje SPA y su AbortSignal. Se extraen/actualizan funciones de estado existentes cuando sea útil. El motor y el render no harán fetch directamente. Se reutilizan sesión, cliente HTTP, rutas a login/colección y contratos de balance. `confeti.js` sólo se reutilizará si tiene limpieza/cancelación adecuada; una animación no acredita un premio.

El engine recibe reloj y fuente de lanzamientos inyectables para pruebas. `requestAnimationFrame` dibuja; `performance.now()`/tiempo de simulación calculan movimiento local, sin hacer depender dificultad de FPS. Un AbortController por montaje invalida timers, RAF, listeners y respuestas tardías al salir/reiniciar. Juego no instala listeners globales duplicados ni bloquea teclado de formularios ajenos.

## 7. Contrato frontend/backend previsto

Se propone un subprotocolo **`/api/v1/games/beta`** porque el contrato actual limita estados y exige premios falsos por tipo literal. No es otra cuenta ni otro sistema de puntos: usa los mismos intentos y ledger. Permite conservar intactas las peticiones legacy y sus respuestas. La creación de rutas sólo ocurrirá en la etapa correspondiente.

| Ruta propuesta | Entrada mínima / autoridad |
| --- | --- |
| GET `/api/v1/games/beta/config` | Público: versión y proyección de reglas; sin usuario ni saldo. Puede implementarse con configuración en Prompt 2 sin SQL. |
| POST `/api/v1/games/beta` | JWT, `Idempotency-Key`, `{mode: classic|streak}`. Servidor fija UUID, reglas, elegibilidad y condiciones de reloj. No recibe score, puntos, user_id o win. |
| GET `/api/v1/games/beta/{id}` | Estado propio, revisión, métricas autoritativas, lanzamiento actual/última resolución y decisión de premio; 404 para ajeno/inexistente. |
| POST `/api/v1/games/beta/{id}/pitches` | Solicita el siguiente lanzamiento con revisión. Sólo uno activo, secuencia consecutiva y respuesta repetible, sin adelantarse al límite del modo. |
| POST `/api/v1/games/beta/{id}/pitches/{pitch_id}/swing` | Identidad, revisión y clave de solicitud/acción. No recibe `hit`, `perfect`, score ni hora con autoridad del cliente. Reintento devuelve la misma adjudicación. |
| POST `/api/v1/games/beta/{id}/transitions` | Pausa/reanudación/abandono con revisión y política del protocolo beta; no reabre terminales. |
| POST `/api/v1/games/beta/{id}/complete` | Petición de cierre/reconciliación, sin declarar victoria, puntos o resumen confiable. Calcula todo desde datos del servidor y retorna el mismo cierre al repetir. |

Se define `/config` antes de la ruta dinámica del router beta. GET/inicio/transición/repetición pueden devolver 200; no se depende de 201 para reconocer éxito. 401 pide sesión; 404 no revela partidas ajenas; 409 exige conciliar revisión/configuración/estado; 422 rechaza cuerpo/UUID inválidos; 429 limita frecuencia; Auth puede responder 503 y REST 502. Red/timeout/5xx no se anuncian como fracaso económico definitivo: GET y misma clave antes de otra operación.

La respuesta beta separará `game` (modo, versión, estado, outcome, revisión), `stats` (resueltos, aciertos, fallos, perfectos, score y rachas), `pitch` (identidad/secuencia/tiempos públicos) y `reward` (estado, importe, ID de evento cuando exista, motivo y saldo actual si corresponde). El importe nunca se suma a una copia local del balance. Finalizar Clásica no se admite con nueve lanzamientos; Racha puede cerrar al quinto consecutivo antes de 15.

Los endpoints legacy no deben intentar serializar sesiones beta con `GameRead`: devolverán 404 para IDs del nuevo protocolo. La migración/servicio también impedirá usar `restart_of` o transiciones legacy para cambiar una beta. Se conservan sus resultados para los intentos legacy ya existentes; se agregan pruebas de acceso cruzado entre protocolos.

## 8. Validación de bateo y frontera de seguridad

Estrategia preferida para investigar en Prompt 3: **lanzamientos y adjudicación autoritativos e incrementales**. El servidor crea el pitch, secuencia y reloj, registra una acción aceptada y resuelve normal/perfecto/fallo; agrega estadísticas desde registros propios. No acepta un lote final de aciertos autoafirmados. Caducar un lanzamiento resuelve un fallo una sola vez. UUID/nonce firma una referencia, no el talento de quien juega.

Los timestamps del navegador, su score y una reproducción de eventos aportados sólo al final son manipulables. Si se usa HTTP para batear, hace falta una referencia temporal de recepción **capturada en infraestructura confiable**, no un header/hora elegida por el usuario, y una política acotada de latencia. Se debe probar que viaje de red, Auth y PostgREST no hacen injusta una ventana de 150 ms. Hoy `get_current_user` consulta `/auth/v1/user` por HTTP en cada petición protegida: no debe confundirse el final de esa consulta con la hora inicial de la acción. La solución temporal concreta se elige y mide antes de premiar; no se instalará WebSocket ni otra dependencia por anticipado.

Un bot también puede enviar comandos válidos con timing exacto. Autoridad del servidor evita `win=true`/score arbitrario, pero **no prueba humanidad ni resuelve por sí sola farming/multicuenta**. Se requieren decisión explícita sobre ese abuso, política de participación para el premio base y límites verificables. Si la estrategia no ofrece evidencia suficiente, el producto seguirá jugable y el backend mantendrá premios bloqueados; no se cambiará esa conclusión por un flag cliente o un simple mínimo de segundos.

## 9. Persistencia y economía previstas

Reutilizar `activity_attempts`, sin tabla paralela de partidas. Será necesaria **una migración nueva hacia adelante** para identificar protocolo/version/snapshot de reglas, modo, resultado validado, estadísticas y decisión económica. Los campos de legado deben conservar su semántica.

Un historial acotado de lanzamientos/acciones del servidor sí requiere persistencia. Se propone una tabla hija `game_pitches` con FK al intento y unicidad `(attempt_id, sequence)`/acción aceptada. No duplica balances, inventario ni recompensas. Su necesidad y estructura se comprobarán al implementar; no se guardará un historial ilimitado en metadata enviada por cliente ni sólo en memoria de FastAPI, que puede reiniciarse o tener varias instancias.

La restricción `managed_game_shape` y el trigger de bloqueo deben ampliarse deliberadamente para **beta validada**, conservando el rechazo de sesiones legacy no verificadas. No se desactivará el trigger ni RLS para poder dar premios. Sólo un servicio autenticado y RPC privilegiadas podrán registrar acciones/resultado; metadata `validated:true` del cliente no habilita nada.

La RPC de cierre deberá, dentro de una transacción:

1. Tomar bloqueos compatibles con Fase 1: perfil antes de intento/operación cuando se involucren ambos; nunca adquirir perfil después de tener un intento bloqueado que necesite ese perfil.
2. Releer pertenencia, protocolo, reglas fijadas y resultado derivado de lanzamientos válidos. Verificar terminalidad y reintento antes de decidir una nueva recompensa.
3. Fijar una fecha de decisión económica de servidor y consultar las partidas beta premiadas de ambos modos para ese usuario/día bajo el mismo lock de perfil.
4. Si hay plaza y evidencia suficiente, acreditar 10+bono en **un** evento `game_completion` con `card_id=NULL`, separado de trivia/AR/compra y con clave estable del servidor basada en el intento. El cliente no elige la operación económica ni el importe.
5. Si la cuota está agotada, cerrar con decisión persistida `daily_limit`, crédito cero y sin fila de recompensa que aparente una entrega. No bloquear el juego. Evitar tablas de cuotas adicionales si el ledger y el lock existente bastan.
6. Guardar cierre, resultado validado y decisión junto con saldo/evento; todo confirma o todo revierte. Retornar el saldo actual del perfil, como las operaciones de Fase 1.

Un reintento de una partida decidida ayer no obtiene otra plaza al llegar medianoche. Un cierre sin premio por límite tampoco se convierte en premiado mañana. Inicio/abandono no consumen plazas. Dos cierres simultáneos de partidas distintas con una plaza restante no pueden otorgarse ambos. La unicidad v2 por intento evita separar base/bono o cobrar con otras claves. Los guardas deben impedir una concesión por la RPC genérica con otro importe/evento o usando un intento genérico falsificado.

Conviene limitar una beta activa por usuario y definir caducidad/retención/frecuencia de inicio/acciones; son propuestas de seguridad aún por parametrizar, no la cuota de tres **partidas jugables**. La cuota económica jamás se usará para impedir practicar después de tres partidas. No se crean endpoints de autoasignación de puntos o cartas.

Nada de este SQL se creó o aplicó en Prompt 1. Los 22 archivos históricos se conservan. Aplicar migraciones remotas, desplegar, hacer push o merge requiere instrucciones posteriores: no forma parte de esta preparación.

## 10. Riesgos y decisiones que acompañan la implementación

| Riesgo / decisión | Tratamiento previsto |
| --- | --- |
| Falta motor completo | Prompt 2 implementa práctica determinista y UX antes de conectar dinero/puntos económicos. |
| Recompensar inactividad o automatización | No usar sólo timeouts/nonce/duración como evidencia. Definir política de participación/abuso; premios desactivados hasta superarla. |
| Latencia, reloj y reinicio del backend | Autoridad temporal y persistencia de servidor; medir con Auth real, no sólo dobles. No fiarse de reloj del teléfono. |
| Pausa usada para acertar o alargar una sesión | Reglas de práctica y premiable explícitas; deadline activo del servidor no se congela por editar UI. |
| Varios clics/touch/tecla o mensajes fuera de orden | Una resolución por pitch, secuencia/revisión, claves estables y deduplicación. |
| Estado perdido por SPA, logout, recarga o pestaña oculta | AbortSignal, IDs por instancia, respuestas por generación, GET de conciliación; ninguna entrega retrospectiva de una práctica. |
| Doble premio, varias pestañas o cambio de día | Cierre y cupo atómicos por usuario, una entrega por intento y fecha de decisión persistida. |
| Contrato Fase 2A / bloqueo SQL | Protocolo explícito, DTOs y guardas versionados; no interpretar intentos legacy como partidas beta validadas. |
| Arte integrado / CSS global | Separar entidades del dibujo, estilos de juego acotados y controles accesibles; no modificar Colección/AR/trivia por estética. |
| Reglas numéricas cambiadas durante partida | Snapshot/versionado del backend; no permitir que un cliente antiguo escoja una tarifa anterior. |
| Alcance de «beta completa» | Práctica jugable, validación de servidor y entrega económica son hitos distintos. No marcar los tres por una animación o unitarias solamente. |

Los tiempos, política de pausa premiable, zona/fecha del cupo, retención y participación mínima defendible son decisiones provisionales o pendientes descritas arriba. No bloquean la construcción del motor local del Prompt 2. El TypeError de MutationObserver investigado en Fase 2B y observado en Fase 3 sigue como antecedente; no se atribuye al futuro motor ni se oculta su consola.

## 11. Checklist por etapa y aceptación

### Etapa 1 — Este Prompt 1

- [x] Git local/remoto contrastado; rama nueva desde `main` actualizado; sin descartar trabajo.
- [x] HTML, JS, CSS, recursos, rutas, esquemas, SQL, economía y pruebas auditados.
- [x] Diferenciadas maqueta, funciones reales e infraestructura desconectada.
- [x] Búsqueda de reglas previas; fixtures numéricas no confundidas con reglas de producto.
- [x] Reglas beta propuestas, estados, archivos, contrato, riesgos y criterios preparados aquí.
- [x] Regresión actual ejecutada y límites de esas pruebas declarados.
- [x] Motor implementado posteriormente en Prompt 2; no formaba parte de la auditoría original.

### Etapa 2 — Prompt 2: juego local completo, sin premios económicos

- [x] Configuración única/versionada y modo práctica explícito; generador público fuerza premios desactivados.
- [x] Selección → instrucciones → Comenzar → cuenta atrás → lanzamientos reales → golpes → métricas → resultado → replay.
- [x] Clásica 10/6; Racha 15/5; perfecto/normal/fallo y límites exactos probados con reloj inyectado.
- [x] Pausa/reanudación, abandono, reinicio y fin repetido sin estados residuales ni acciones después del final.
- [x] Botón nativo preparado para ratón/táctil y Espacio/Enter, sin doble entrada ni victoria por pausar. Tacto físico pendiente.
- [x] Cuatro viewports comprobados, controles principales ≥44 px y CSS de movimiento reducido. Hardware, preferencia activada y auditoría formal de contraste pendientes.
- [x] Ninguna llamada económica ni propiedad de carta simulada. UI de saldo/premio no promete un crédito inexistente.
- [x] Unitarias del motor/modos, navegación SPA, recursos liberados y evidencia de navegador.

**Salida exigida de Prompt 2:** un minijuego realmente jugable de principio a fin en ambas modalidades, con tests deterministas y sin relajar las barreras económicas existentes. El servidor completo puede seguir pendiente. No hace falta esperar por decisiones de antifarming para entregar práctica funcional.

### Etapa 3 — Servidor, persistencia y entrega segura

- [x] Protocolo temporal de servidor con tres probes, compensación acotada y participación mínima; riesgo de bots documentado. Medición de jitter en staging pendiente.
- [x] API beta estricta, Auth real, pertenencia, secuencias/revisiones e intentos persistidos reutilizados.
- [x] Migración nueva local: separación de legado, historial JSONB limitado de pitches, restricciones, permisos y guardas.
- [x] Servidor deriva aciertos/score/outcome; rechaza resultados, precios, premios, timestamps e identidades del cliente.
- [x] Un evento por partida, 10/50/60 y cupo de tres premiadas/día entre modalidades; cuarta partida comprobada sin crédito.
- [x] Concurrencia, rollback, otras claves, cuenta ajena, genéricos falsificados y cuota por día de decisión persistido probados.
- [x] Respuesta perdida y recarga: GET y misma clave, crédito persistente una sola vez. Reinicio de proceso con estado en DB no requiere memoria de servidor; prueba de kill en pleno commit pendiente.
- [x] Premios oficiales derivados de eventos recibidos y reloj DB; práctica/legacy siguen bloqueados. Automatización humana no demostrada, cupo interno acota abuso.

### Etapa 4 — Integración y aceptación de beta

- [x] Flujo UI→Auth→FastAPI→PostgREST→PostgreSQL con cuenta sintética local real.
- [x] Reglas de ambos modos comprobadas en SQL; Racha oficial ganada en navegador, abandono/práctica sin premio, cuarta victoria sin crédito y compra persistente.
- [x] Saldo consultado en Colección y compartido por pestañas; regresión de trivia/AR mediante suites existentes sin cambios económicos.
- [x] Suites, build, SQL clean/upgrade, carreras y navegador local ejecutados; informe distingue reloj real, fixtures y matriz responsive anterior.
- [x] Documentación/evidencias, diff local, patrones de claves privadas e historial de migraciones revisados; rama conservada.
- [ ] Hardware físico, staging/latencia y revisión final de publicación.
- [ ] Merge, push, despliegue y aplicación remota sólo con autorización posterior. No se ejecutarán por completar una checklist de este plan.

## 12. Comprobaciones ejecutadas en esta auditoría

| Comprobación | Resultado real de este Prompt 1 |
| --- | --- |
| Fetch y comparación Git | `main=origin/main=dbc6212`; árbol inicialmente limpio; nueva rama sin sobrescribir otra. |
| Lectura/búsqueda y recurso visual | Código/docs/SQL contrastados; boceto inspeccionado; dimensiones PNG leídas de cabecera; ausencia de otro motor/reglas en la búsqueda descrita. |
| `npm test`, desde `frontend` | **90 aprobadas**, cero fallidas/skips. Incluye las seis de juego: pausa, reanudación, abandono, clic sin victoria, doble montaje y reentrada limpia. |
| `.\venv\Scripts\python.exe -m pytest -q -p no:cacheprovider`, desde `backend` | **118 aprobadas**. `test_games.py` aporta 38 casos de API/servicios; no demuestra bateo ni victorias todavía. Advertencia heredada de deprecación Starlette/TestClient/HTTPX. |
| Instanciación de esquemas actuales | Rechaza modo no soportado en `GameStart`, transición `win` y habilitar premios en `GameRead`. Sin llamadas a Supabase. |
| SQL / historial | Leídas la migración y las 63 aserciones de juego; inventario local de 22 migraciones. **No ejecutado SQL ni Docker en esta etapa**. Las 406 aserciones/38 carreras de Fase 3 son antecedentes, no una nueva ejecución. |
| Build / navegador / producción | **No ejecutados en esta etapa documental**. Las unitarias usan dobles de DOM/REST; la inspección del archivo de imagen no equivale a una partida real en navegador. |

No se agregaron tests de una mecánica que todavía no existe ni se declararon victorias/derrotas/recompensas probadas. Los comandos de regresión son reproducibles con las herramientas ya instaladas; no se instalaron paquetes. El runner frontend incluye pruebas heredadas locales ignoradas, como advierte Fase 3; los nuevos casos de beta deberán quedar versionados en `checks/`.

## 13. Preparado para comenzar el Prompt 2

1. Trabajar sobre esta misma rama y leer este plan con el estado actual antes de editar.
2. Implementar primero configuración y reglas puras de ambos modos con reloj inyectado, métricas e invariantes.
3. Construir campo/entidades separados y conectar entrada, fases, pausa y replay al montaje SPA existente.
4. Sustituir el resultado fijo de carta por resultado real de juego; mantener premios deshabilitados.
5. Probar casos de frontera y flujo completo en navegador; registrar evidencia y mantener la separación entre score y saldo.

**Entrega histórica de Prompt 1:** rama + auditoría y plan. Prompt 2 añadió la práctica y Prompt 3 integró la economía oficial, comprobada sólo localmente. No se hicieron commits, push, despliegues ni migraciones remotas. El informe backend contiene la evidencia actual y las verificaciones pendientes para Prompt 4.
