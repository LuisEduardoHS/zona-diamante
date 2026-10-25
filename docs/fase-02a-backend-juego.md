# Zona Diamante — Fase 2A: backend del juego y seguridad

Fecha: 25 de octubre de 2026 (`America/Mexico_City`). Repositorio: `D:\projects\zona-diamante`.

**Estado: PARCIAL.** Las correcciones verificables y el protocolo de sesiones están implementados. El juego sigue siendo una maqueta: no existen reglas de victoria/derrota ni evidencia fiable para premiar. Esa parte queda pendiente de definición; las recompensas de las sesiones nuevas permanecen bloqueadas. La pantalla todavía no consume la API de partidas.

## 1. Estado inicial del juego

Se verificó la rama `feat/collection-cards`, HEAD `32973d5` (`fix(database): stabilize migrations and reward idempotency`). El árbol estaba limpio; Git avisó que no podía inspeccionar la carpeta ignorada `.pytest_cache`. No se cambiaron permisos ni se descartaron archivos.

Fuentes revisadas: auditoría general, informe Fase 1, HTML/JavaScript del juego y navegación, rutas/servicios/esquemas FastAPI, migraciones históricas y pruebas existentes. Los documentos anteriores se trataron como antecedentes: se contrastaron sus afirmaciones con código y ejecuciones actuales.

Sólo existe una pantalla de juego, un boceto de bateo. Trivia y AR son actividades independientes, con otras reglas y controladores. Archivos del juego:

- `frontend/public/pages/experiencias/juego.html`: imagen `boceto-PI.webp`, mensaje “Toca la pantalla para batear”, botón Pausar, enlace Colección y overlay estático “¡Ganaste!”/carta Dorados.
- `frontend/public/js/features/juego/ganar_juego.js`: originalmente cinco líneas; un listener `click`, `{ once: true, signal }`, añadía `activo` al overlay.
- `frontend/public/js/app/navegacion.js`: importa y monta `iniciarJuego(signal)`; cancela el ciclo anterior con `AbortController` al navegar.

No había motor, bola simulada, validación de bateo, puntuación, temporizador, niveles, vidas, derrota, reinicio explícito ni abandono registrado. Pausar no tenía controlador propio. No había peticiones FastAPI, uso de intentos ni premios reales: la carta era contenido fijo del HTML. No se encontraron pruebas específicas del juego.

## 2. Arquitectura encontrada

Frontend HTML/CSS/ES modules, navegación SPA sin framework. El juego es público. La API FastAPI tiene autenticación Bearer consultando Supabase Auth, servicios HTTPX y acceso privilegiado a PostgREST. Las RPC económicas operan en PostgreSQL con locks e idempotencia de Fase 1.

Tablas reutilizadas: `activity_attempts`, `profiles`, `reward_events`, `user_cards`. El estado histórico de intentos permite `started/completed/rejected/expired`; los tipos son `trivia/game/ar`. No se crean tablas ni se cambian esos valores. La API genérica de intentos admite metadata del usuario, por lo que esa metadata **no constituye estado autorizado ni prueba de victoria**.

`/api/v1/rewards` sólo permite lectura. No había finalización pública de juegos. `complete_activity_attempt` es privilegiada, genérica y no conoce reglas de juego; no debe conectarse a una declaración de resultado del navegador.

## 3. Flujo de partida: antes y después

Antes: entrar → primer clic en cualquier descendiente de la imagen → overlay de victoria. El listener de una sola ejecución impedía repetir el clic en ese montaje, pero no validaba ninguna regla. La navegación cancelaba el listener; no existía un resultado persistido.

Ahora, en la pantalla pública: montar → `active` → Pausar → `paused` → Reanudar → la misma instancia `active`. Salir de la ruta cancela listeners y marca esa instancia local `abandoned`. Volver monta una instancia limpia y oculta cualquier resultado estático residual. Tocar la imagen no determina victoria ni derrota. No hay controles visuales nuevos.

En la API independiente: inicio autenticado → `active` → `paused` ↔ `active` → `abandoned`. `abandoned` es terminal. Reiniciar abandona el origen y crea una sesión distinta, activa y sin resultado, en una sola transacción. El navegador de esta fase no llama estas rutas: salir de la pantalla no abandona por HTTP una sesión creada externamente.

No se añadió una transición `won/lost/completed`, porque no hay reglas que la fundamenten. No existe finalización económica del juego.

## 4. Problemas confirmados

1. **Pausa anunciaba victoria.** Antes del cambio se ejecutó el módulo real con un DOM mínimo: un clic cuyo target era `.pause-button` produjo `pauseClickShowsWin: true`. También se observó el comportamiento anterior en navegador.
2. **Cualquier clic equivalía a ganar**, incluido el enlace de colección por propagación. La única condición era recibir el evento, no jugar.
3. **Pausa/reanudación inexistentes.** No había estado que pudiera pausarse ni control de transiciones.
4. **Overlay presentado como premio sin entrega real.** No existía escritura de inventario ni de puntos; el texto no acreditaba propiedad.
5. **Ausencia de protocolo de partidas.** Había intentos genéricos, pero ningún inicio/reinicio/transición específica, pertenencia y concurrencia para sesiones del juego.
6. **Compatibilidad REST con claves heredadas.** La primera integración real obtuvo 401 al llamar `start_game_attempt`: el cliente central enviaba la clave JWT `service_role` sólo como `apikey`, sin Bearer para PostgREST. No apareció en las unitarias con dobles ni en las pruebas SQL directas.

No se confirmó un endpoint previo que permitiera al navegador cobrar puntos arbitrarios. La falta de motor, derrota y reglas se documenta como funcionalidad pendiente, no como mecánicas implementadas que hayan fallado.

## 5. Correcciones implementadas

- Se eliminó el listener que anunciaba victoria por clic; no se reemplazó por otra condición ficticia.
- Se añadió un estado local mínimo, pausa/reanudación, abandono terminal y protección contra doble montaje del mismo elemento.
- Un montaje nuevo limpia el overlay anterior. La cancelación SPA quita el listener de pausa.
- Se implementaron sesiones autenticadas, reintentos estables, propiedad, revisión optimista y reinicio atómico en PostgreSQL.
- Se impide completar económicamente una sesión administrada mediante la RPC genérica y se bloquea insertar eventos asociados a ella, incluso de cero puntos.

## 6. Cambios de backend y contrato

Archivos nuevos: `app/schemas/game.py`, `app/services/games.py`, `app/api/routes/games.py`. `app/main.py` registra el router. Se reutilizan `get_current_user` y el cliente REST existente.

En `app/db/supabase.py` se añade `Authorization: Bearer <clave>` cuando la credencial configurada tiene formato JWT heredado (tres segmentos). Las claves modernas opacas `sb_secret_*` siguen enviándose únicamente como `apikey`. Las credenciales permanecen en servidor y no se registran. Esta corrección permite probar el recorrido real local sin modificar Auth ni permisos del navegador; tiene dos pruebas de transporte adicionales.

| Endpoint | Entrada | Resultado |
| --- | --- | --- |
| `POST /api/v1/games` | JSON `{}`; header `Idempotency-Key` de 1–128 caracteres tras trim | 200, sesión activa con UUID generado en BD; reintento devuelve esa misma sesión en su estado actual. |
| `POST /api/v1/games` | `{"restart_of":"UUID"}` y nueva clave de operación | 200, abandona el origen propio y crea un sucesor. Reintento con la misma clave devuelve el mismo sucesor. |
| `GET /api/v1/games/{UUID}` | Bearer | 200, sólo sesión administrada propia; 404 para ajena, inexistente o intento genérico. |
| `POST /api/v1/games/{UUID}/transitions` | `{"action":"pause|resume|abandon","expected_revision":0}` | 200, transición o reintento exacto; 409 para estado/revisión en conflicto. |

Todas requieren autenticación. Creación y repetición devuelven 200 deliberadamente. El resultado expone únicamente `id`, `game_state`, `game_revision`, `started_at`, `completed_at` y `rewards_enabled:false`; no expone claves internas ni metadata. `completed_at` es el momento de cierre por abandono, no evidencia de victoria.

`pause` requiere `active`; `resume` requiere `paused`; `abandon` acepta cualquiera de ambos. Cada cambio incrementa la revisión. Repetir la misma acción con su revisión original devuelve el resultado ya aplicado si sigue exactamente en la revisión siguiente/estado objetivo. Un reintento antiguo después de otros cambios produce 409. Nunca reabre una sesión terminal.

Reiniciar es una nueva operación explícita, no reanudar. Sólo puede existir un sucesor por origen; otra clave para reiniciar ese mismo origen da 409. La clave se separa por usuario y operación/origen. Reintentar el inicio original después de abandonarlo devuelve el original abandonado, no crea otra sesión.

Entradas estrictas: no se aceptan usuario, score, puntos, premios, metadata, `win` o `completed`. La revisión exige entero real, no booleano/string. UUID inválido y cuerpos inválidos producen 422; falta de token 401; fallos desconocidos de Supabase 502 con mensaje genérico. No se añadieron rutas `/complete`, `/finish` ni `/rewards` del juego.

## 7. Cambios SQL

Única migración nueva: `20261025000100_game_attempt_lifecycle.sql`.

- Añade cuatro columnas nullable a `activity_attempts`: `game_state`, `game_revision`, `game_request_key`, `game_parent_id` (FK al intento anterior).
- Los intentos históricos mantienen las cuatro columnas NULL. Metadata arbitraria no activa el protocolo.
- `managed_game_shape`: tipo `game`, revisión no negativa, clave presente, score NULL; estados activos/pausados sólo con `status=started` y sin fecha de cierre; abandono sólo con `status=rejected` y fecha de cierre.
- Índices únicos por usuario/clave y por origen de reinicio. No hay tabla duplicada de sesiones o premios.
- `start_game_attempt`: lock de perfil primero y luego origen, consistente con Fase 1. Serializa inicios/reinicios por usuario. Abandono e inserción del sucesor son atómicos.
- `transition_game_attempt`: lock de fila y comprobación de revisión; peticiones simultáneas no sobrescriben cambios a ciegas.
- `block_unvalidated_game_reward`: trigger BEFORE INSERT/UPDATE en `reward_events`, rechaza eventos cuyo intento tiene `game_state` administrado. El CHECK también impide que la RPC económica cambie ese intento a `completed`; el fallo revierte cualquier crédito anterior en la transacción.
- Funciones `SECURITY INVOKER`, `search_path` explícito; ejecución sólo para `service_role`, revocada a PUBLIC/anon/authenticated. No se amplían permisos de tablas del navegador ni se desactiva RLS.

Las 20 migraciones existentes se conservaron sin editar, renombrar o eliminar. No se aplicó SQL remoto. Se comprobó upgrade desde los 18 históricos, checkpoint Fase 1 de 20 migraciones y luego la nueva (21), preservando datos editoriales y económicos anteriores.

## 8. Cambios funcionales mínimos del frontend

Sólo se cambia `frontend/public/js/features/juego/ganar_juego.js`. `crearEstadoJuego` limita transiciones locales; `iniciarJuego` monta una sola instancia, limpia resultado residual y conecta pausa/cancelación. Se actualizan únicamente los atributos accesibles `aria-label` (Pausar/Reanudar) y `aria-pressed`. El botón conserva su aspecto.

No se modificaron HTML del juego/colección, CSS, colores, tipografía, animaciones, distribución ni framework. El HTML estático del premio se conserva oculto para respetar el alcance; editar el DOM desde DevTools puede mostrarlo, pero no entrega cartas ni puntos.

No se conecta automáticamente la maqueta pública con una API autenticada: faltan reglas y decisión sobre participación invitada, manejo de fallos de red y experiencia de sesión. La API está implementada y probada localmente para una integración posterior; no se desplegó. El estado local no pretende ser una autoridad económica.

## 9. Seguridad y validación de victorias

Un clic o una petición que afirme ganar no demuestran una victoria. El servidor puede comprobar identidad, propiedad, revisión, secuencia de estados, reintentos y atomicidad. No puede comprobar una habilidad, golpe válido o resultado de un motor inexistente.

Las sesiones administradas no admiten score ni resultado, no generan `reward_events`, no alteran balances y no conceden inventario. No se aceptan recompensas desde el cliente ni se usan eventos de trivia para juegos. Los fallos de propiedad no revelan la existencia de partidas ajenas.

**Límite de la protección SQL:** se aplica a las nuevas sesiones administradas. La RPC genérica privilegiada conserva su contrato para intentos históricos/no administrados, incluidos fixtures de juego de Fase 1. Eso no ofrece una ruta de premio al navegador: las RPC sensibles y tablas siguen inaccesibles para anon/authenticated y no hay endpoint público que finalice esos intentos. Un servicio privilegiado futuro no debe premiarlos basándose en metadata del cliente. Un administrador/credencial privilegiada con escritura directa sigue siendo parte de la frontera de confianza.

## 10. Integración futura con recompensas

**Implementado:** identificación estable por usuario/partida/operación, revisión, reinicio seguro, barreras SQL y `rewards_enabled:false`. Se reutiliza `reward_operation_key` sólo para calcular claves de sesión; no crea eventos económicos.

**Propuesto, no implementado:** definir reglas reales y una fuente de evidencia antes de diseñar el endpoint de validación. Si se elige simulación autoritativa o reproducción de comandos, el servidor deberá emitir los parámetros necesarios y verificar la secuencia completa. Un temporizador, score del cliente, nonce o firma de datos aportados por el propio navegador, por sí solos, no prueban habilidad/victoria. La estrategia debe evaluar automatización y abuso además de idempotencia.

El futuro validador y las reglas económicas necesitarán una migración adicional que habilite estados/resultados validados, amplíe el CHECK/trigger de forma deliberada y conceda una recompensa por intento con clave estable del servidor, namespace propio y pruebas de atomicidad/concurrencia. No se fijaron cantidades, cartas, cuotas, niveles o precios ni se modificó la economía de colección/trivia.

## 11. Pruebas ejecutadas

Herramientas existentes, sin instalar/actualizar paquetes. Docker respondió versión 29.8.0.

| Comprobación | Resultado y alcance |
| --- | --- |
| `python -m pytest -q -p no:cacheprovider` con el venv de backend | 102 aprobadas: 62 previas + 38 nuevas de API/servicios y dos del transporte de credenciales. Auth, identidad, entradas, UUID, 404/409/422/502, contratos y rechazo de premios. Dobles REST en estas unitarias. |
| `npm test` desde frontend | 44 aprobadas: 38 previas + 6 nuevas del juego; sin skips ni fallos. Parte de las pruebas locales previas está ignorada por Git; las seis nuevas están en `checks/` y sí se incluyen en la entrega. |
| `npm run build` desde frontend | CSS, bundle Supabase y configuración pública generados correctamente con herramientas ya instaladas; salidas ignoradas por Git. |
| Runner Fase 1 antes de cambios SQL nuevos | Instalación limpia y upgrade: 81 + 14 aserciones por entorno (190 total), siete carreras por entorno (14 total), seed repetido y preservación de datos, aprobados. |
| Runner Fase 2A | Instalación limpia y upgrade: 81 Fase 1 + 63 juego + 14 esquema por entorno (316 total); siete carreras económicas y siete de juego por entorno (28 total), aprobados. |
| Navegador local | Pausa no abre victoria; campo pausado no gana; reanuda; salir/iniciar otra visita no conserva overlay ni pausa. Comprobado con origen limpio `127.0.0.1:5512`. |
| Integración Auth/FastAPI/PostgREST real | 34 comprobaciones por entorno (68 total), aprobadas sin sustituir la dependencia de identidad. Usuarios sintéticos, tokens de Auth local, RPC por PostgREST, propiedad, estados, errores, cero premios y reintento HTTP concurrente. FastAPI se invoca por ASGI/TestClient, no por un servidor TCP externo. |
| Git | Rama/HEAD comprobados, `git diff --check` sin errores; sin cambios en migraciones históricas/HTML/CSS versionados. |

Comandos reproducibles desde la raíz:

```powershell
Push-Location backend
.\venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
Pop-Location
Push-Location frontend
npm test
npm run build
Pop-Location
.\backend\venv\Scripts\python.exe backend/checks/phase02a_database.py
```

El runner de Fase 1 se amplía de forma compatible: conserva el checkpoint original, aplica después migraciones posteriores, comprueba preservación y permite un callback para verificaciones adicionales. El runner Fase 2A reutiliza su aislamiento y suma siete carreras reales: inicio duplicado, pausa duplicada, pausa/abandono conflictivos, reinicio duplicado, dos claves de reinicio, reinicio/abandono y finalización económica fraudulenta/pausa.

`phase02a_game_test.sql` ejecuta 63 aserciones con roles reales, constraints, identidad, claves, estados terminales, metadata falsa, bloqueo económico, integridad y rollback forzado al fallar la inserción del sucesor. Los fixtures pgTAP se revierten. El runner exige plan TAP completo sin SKIP/TODO y valida contadores reales; un fallo aborta la aceptación.

Los proyectos generados `zd_phase01_clean_<id>`/`zd_phase01_upgrade_<id>` viven bajo `.tmp`, con marcador de desechable, puertos propios y sin vínculo remoto. Sólo se resetean esos proyectos `--local`. No se copian credenciales ni `.env` del proyecto original al entorno CLI; sólo `docker exec` al contenedor derivado de su identificador. Se detienen exclusivamente esos contenedores. Los directorios de trabajo permanecen ignorados para inspección.

Advertencia existente: TestClient/Starlette avisa de deprecación de HTTPX; no se actualizan dependencias sin autorización. En un origen de navegador previamente utilizado se observó el módulo anterior pese a recargar; se verificó la versión nueva en un origen local limpio. El futuro despliegue debe asegurar invalidación de activos/caché.

Hubo una ejecución intermedia fallida del nuevo recorrido HTTP: se detuvo en la comprobación 7 (inicio, respuesta REST 401), después de pasar SQL y carreras en el primer entorno. Se corrigió el transporte de JWT heredado y se volvió a ejecutar el runner completo: **exit 0**, ambos entornos y sus 68 comprobaciones HTTP aprobados. La ejecución incompleta anterior no se cuenta como aceptación de ambos entornos. Los logs REST 400 durante pruebas negativas son esperados: la API los transforma en los 404/409 comprobados.

Evidencia de navegador local (archivo ignorado, no forma parte del código versionado): `.tmp/fase02a-juego-pausado.png`.

## 12. Pruebas pendientes

- Victoria legítima, derrota, score, vidas, niveles y recompensa: **no ejecutables contra reglas inexistentes**. No se consideran aprobadas por comprobar únicamente que se rechaza `win`.
- Juego real completo y consumo de estas rutas desde el frontend: aún no implementados. Pruebas unitarias del estado local y API no equivalen a integración UI→backend.
- Dispositivo móvil físico, pérdida de red, desconexión/cierre de pestaña y política de recuperación/expiración de sesiones.
- Producción/Supabase remoto y estado de su historial: fuera de autorización; no consultados ni modificados.
- Rollout de caché/activos y validación en hosting: no se desplegó nada.

## 13. Riesgos y decisiones pendientes

El equipo debe definir mecánica de bateo, condición de ganar/perder, evidencia verificable, estrategia de simulación/validación, reglas económicas y tratamiento de invitados. También debe decidir límites de partidas, expiración y recuperación de sesiones; no se inventa una cuota o un timeout. Una sesión persistida seguirá iniciada/pausada hasta una acción explícita, porque aún no hay política de expiración ni cliente conectado.

El estado local es manipulable por diseño y no se usa para efectos económicos. La revisión impide escrituras perdidas, pero no acredita participación. Los reintentos antiguos pueden requerir GET y conciliación del cliente; iniciar con una clave nueva representa una operación nueva. Un origen reiniciado sólo tiene un sucesor; para un nuevo reinicio se usa el ID del sucesor.

No se conocen regresiones en las suites ejecutadas. Eso no certifica reglas aún ausentes ni seguridad frente a credenciales privilegiadas comprometidas. La integración pública del juego y sus recompensas queda pendiente, por eso la fase se reporta PARCIAL.

## 14. Procedimiento de migración futura

1. Revisar diff y pruebas de esta fase; conservar los 20 históricos. Ejecutar el runner local completo y revisar que termine con exit 0, sin limpiezas pendientes.
2. Con autorización separada para producción, revisar historial remoto y respaldo. Conciliar diferencias antes de aplicar nada; no usar reset remoto ni corregir historia renombrando archivos.
3. La migración prevista para esta fase es exclusivamente `20261025000100_game_attempt_lifecycle.sql`, después de Fase 1. Verificar previamente que no haya columnas/funciones homónimas no versionadas. Los campos nuevos son NULL para filas existentes.
4. Aplicar por el proceso autorizado y verificar CHECK, índices, trigger y permisos de funciones. No habilitar premios ni cambiar precios. Desplegar backend compatible sólo después de tener el esquema; el frontend actual puede seguir funcionando sin estas rutas.
5. Usar cuentas de prueba autorizadas para iniciar/reintentar/pausar/reanudar/abandonar/reiniciar y comprobar saldo/inventario/ledger sin cambios. Verificar caché de módulos del juego. No usar datos reales para forzar créditos.
6. Ante un fallo, corregir hacia adelante con otra migración; no borrar intentos, ledger o historia ni abrir permisos al navegador. Para habilitar resultados/premios se requiere otra implementación revisada con reglas/evidencia y pruebas propias.

Este procedimiento es documentación: **no se ejecutó sobre remoto ni se desplegó código**.

## 15. Checklist de aceptación

- [x] Rama/base y limpieza inicial verificadas; sin descartar cambios ajenos.
- [x] Auditoría contrastada con código y reproducción del clic de pausa.
- [x] Pausa/reanudación local coherentes; ningún clic anuncia victoria.
- [x] Navegación abandona la instancia local y vuelve sin resultado residual.
- [x] UUID de servidor, autenticación, propiedad y errores seguros en API.
- [x] Estados/revisiones, reintentos y reinicio atómico probados.
- [x] Concurrencia, rollback, RLS/permisos y bloqueo económico comprobados en PostgreSQL.
- [x] Instalación limpia/upgrade, seed y regresión Fase 1 comprobados.
- [x] Auth real local, FastAPI/ASGI y PostgREST integrados sin dobles de identidad.
- [x] Sin premios configurables por cliente, sin API de resultado arbitrario.
- [x] Pruebas unitarias y build pasan; sin cambios visuales/HTML/CSS versionados.
- [x] Sin commits, push, merge, cambio de rama, despliegue, SQL remoto ni instalación de dependencias.
- [ ] Reglas de victoria/derrota y evidencia fiable definidas y verificadas.
- [ ] Motor real e integración frontend/API implementados.
- [ ] Premios diseñados, validados y habilitados con otra migración y pruebas.

Las tres casillas pendientes impiden declarar el juego completo. Las funcionalidades propuestas en las secciones 10, 12–14 no se presentan como implementadas.
