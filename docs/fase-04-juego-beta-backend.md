# Fase 4 · Prompt 3 — Integración oficial de la beta

Fecha: 28 de octubre de 2026. Rama `feat/game-beta-playable`, base `dbc62123a0ac3519484f8e4759979c4a4926cd58`. Se preservó todo el trabajo local del Prompt 2. Sin commit, push, merge, despliegue, migración remota ni instalación de dependencias.

**Implementación integrada y validada localmente:** juego → eventos temporizados → resultado de PostgreSQL → recompensa transaccional → saldo persistente → compra existente de Colección. La publicación corresponde al Prompt 4. Esto no certifica latencia de producción, navegadores físicos ni resistencia absoluta a bots.

## 1. Arquitectura reutilizada

Se revisaron JWT (`get_current_user`, validación con Supabase Auth), servicios de intentos/recompensas, `complete_activity_attempt`, `reward_operation_key`, `purchase_card`, catálogo/inventario, políticas y migraciones. No se crea otro saldo, inventario ni libro económico.

La partida oficial es una fila `activity_attempts(activity_type='game')`. Dos columnas nuevas, `beta_game` JSONB y `beta_request_key`, conservan estado, snapshot de reglas, secuencia limitada a 15 pitches, nonces, estadísticas derivadas, historial e idempotencia. `reward_events` registra el premio; `profiles.points_balance` sigue siendo el saldo único. La compra usa los endpoints y RPC existentes de Colección, sin cambiar su código, precios o política de mascotas AR.

Los intentos legacy de Fase 2A mantienen sus columnas/contratos y premios bloqueados. Un `metadata.validated` del cliente no transforma un intento genérico en beta oficial. Las prácticas del Prompt 2 tampoco se convierten ni canjean retrospectivamente.

## 2. Archivos principales

| Área | Archivos añadidos / modificados en Prompt 3 |
| --- | --- |
| API | `backend/app/api/routes/game_beta.py`, `app/schemas/game_beta.py`, `app/services/game_beta.py`; registro de router en `app/main.py` antes de la ruta legacy con UUID |
| Reglas | `backend/app/core/game_beta_rules.json`: economía oficial habilitada; el generador público sigue forzando práctica sin premios |
| SQL | Nueva `supabase/migrations/20261028000100_game_beta_authority.sql` |
| Cliente | Extensión `frontend/public/js/api/game-client.js`; nuevo `features/juego/game-official.js` |
| Controlador/vista | `game-page.js`, `game-view.js`, textos/IDs funcionales en `pages/experiencias/juego.html`; se conservan diseño, dibujos y motor de práctica |
| Pruebas | `backend/tests/test_game_beta.py`, `backend/checks/phase04_database.py`, `phase04_live.py`, `frontend/checks/game-official.test.mjs`, `phase04-official-preview.cjs` |
| Documentación | Este informe, checklist del plan, referencia histórica en informe frontend y `docs/evidencias/fase04-backend/` |

Los demás archivos sin commit pertenecientes al Prompt 2 se conservan. No se cambiaron migraciones históricas ni archivos de Colección/AR/trivia.

## 3. Endpoints `/api/v1/games/beta`

Todos salvo config requieren JWT válido. La identidad procede exclusivamente del token; los DTOs de entrada prohíben propiedades adicionales. Todas las mutaciones requieren `Idempotency-Key` de 1–128 caracteres útiles.

| Método / ruta | Entrada | Función |
| --- | --- | --- |
| GET `/config` | Sin identidad | Reglas y límites públicos del protocolo |
| POST raíz | `mode: classic|streak` | Inicio único o reintento de la misma solicitud |
| GET `/current` | JWT | Última partida del propietario, o null |
| GET `/{id}` | UUID | Estado, resultado/recompensa persistidos y saldo actual |
| POST `/{id}/probe` | `probe`, `expected_revision` | Tres mediciones de ida/vuelta con nonce de servidor |
| POST `/{id}/pitches` | `expected_revision` | Emite un pitch único y su horario/plan |
| POST `/{id}/pitches/{pitch_id}/swing` | `expected_revision` | Registra recepción; servidor clasifica el bateo |
| POST `/{id}/transitions` | `action: pause|resume|abandon`, `expected_revision` | Ciclo de vida sin cambiar identidad ni resultado por declaración |
| POST `/{id}/complete` | Objeto vacío | Cierre económico derivado del historial válido |

No hay campos aceptados de score, victoria, puntos, precio, user_id, metadata validada o timestamp del navegador. 401 para ausencia/token inválido; 404 indistinguible para partida inexistente/ajena; 409 para secuencia/revisión/latencia/conflicto; 422 para contrato inválido; 429 para límites operativos. Errores SQL inesperados se traducen a un 502 seguro. La respuesta filtra el registro interno de claves y no devuelve credenciales.

GET puede materializar expiración o timeout de un lanzamiento vencido, nunca conceder puntos. El cierre económico es la operación POST idempotente. Leer o recuperar un resultado ya cerrado no vuelve a premiarlo.

## 4. Protocolo temporal y validación

1. PostgreSQL crea UUID, revisión, nonce y expiración. FastAPI adjunta las reglas canónicas desde su archivo local; no toma reglas de la petición.
2. Tres intercambios de nonce miden tiempo desde emisión hasta recepción del siguiente eco. Se usa el menor, para reducir esperas accidentales. El cliente no envía mediciones ni reloj.
3. Se admite partida oficial cuando ese mínimo es ≤250 ms; compensación fija `c=min(mínimo,160 ms)`. Una conexión peor recibe un error explícito y conserva la opción de práctica sin puntos.
4. Cada pitch recibe UUID y horario de servidor: primer lanzamiento con 3000 ms de preparación, siguientes con 800 ms. Antes de emitir el siguiente deben transcurrir al menos 600 ms de feedback. No se pueden solicitar todos los lanzamientos de golpe.
5. Dificultad por bloques de cinco `[1,.94,.88]`, multiplicada por una variación de servidor entre `.92` y `1.08`. Vuelo/contacto/ventanas se escalan juntos: base 1400/1200/±150/±50 ms. La variación cambia tiempos, no decide el acierto al azar.
6. Al recibir swing, `e=hora_DB-start_pitch-c`. Antes de inicio se rechaza. Perfecto si `|e-contacto|≤ventana_perfecta`; normal si ≤ventana_válida; fuera de ella, temprano/tardío. Vencido vuelo+compensación, se deriva `no_swing`.
7. SQL actualiza una sola vez historial, aciertos/fallos, score, racha, máximo y outcome. El cliente sólo proyecta ese resultado.

El renderer oficial estima tiempo desde `server_now` recibido más `performance.now()` transcurrido. No usa `classifySwing` ni el score local para decidir un resultado oficial. Mientras espera respuesta muestra «Validando bateo…», sin sumar provisionalmente puntos. La animación conserva los dibujos y campo del Prompt 2.

**Latencia: límites reales.** La compensación acotada no permite enviar un tiempo arbitrario ni ampliar ilimitadamente la ventana. También impide garantizar justicia perfecta ante jitter, congestión variable o dispositivos lentos. Los 250/160 ms y ventanas deben medirse en staging/móviles antes de producción. La prueba local de cinco aciertos usó reloj real, sin retroceder timestamps del DB; otras pruebas SQL controlan explícitamente el reloj de sus fixtures.

## 5. Estados, pausas y recuperación

Estados oficiales: `waiting → pitch → waiting … → ready → completed`, además de `paused`, `abandoned`, `expired`. Cada mutación usa revisión y bloqueo; no se aceptan secuencias imposibles ni UUID de pitch viejo.

Pausar detiene la emisión del siguiente lanzamiento. **El plazo del pitch actual sigue corriendo en servidor**; si vence durante pausa/desconexión se registra fallo. Reanudar conserva la misma partida, con la revisión/resultado que corresponda. La UI lo explica; no se ofrece congelar el reloj oficial como en práctica. El cliente concilia un timeout concurrente y reintenta una vez la transición con la nueva revisión.

Recarga/desmontaje SPA cancela RAF y peticiones visuales, sin declarar abandono al servidor. Un diario local por usuario guarda clave de inicio e ID antes/después de la operación; si se perdió una respuesta, se consulta el estado y se reutiliza la misma clave. El servidor conserva la autoridad aunque se borre/manipule ese diario. `/current` permite encontrar la última partida del propietario; el botón distingue recuperación de nueva partida. Tras recuperar, replay/cambio de modalidad permiten una partida nueva.

Cerrar/reiniciar explícitamente pide confirmación y solicita abandono antes de crear otra partida. Si no se puede confirmar, se cierra sólo la vista conservando recuperación; no se presenta como un abandono confirmado ni como un premio. Un resultado legítimo ya cerrado es inmutable. Cambio de usuario destruye la vista anterior y usa otro diario; no aplica respuestas viejas a la cuenta siguiente.

Si el almacenamiento está bloqueado se detiene el inicio oficial antes de perder su clave de recuperación; queda disponible la práctica. Dos pestañas pueden observar la misma partida; las restricciones del servidor evitan dos partidas activas y resoluciones/premios duplicados.

## 6. Economía

| Resultado validado | Puntos de cuenta |
| --- | --- |
| Completar derrota con al menos 3 intentos de bateo aceptados | 10 |
| Victoria Clásica (6/10) | 10 + 40 = **50** |
| Victoria Racha (5 consecutivos en hasta 15) | 10 + 50 = **60** |
| Sólo esperar, con menos de 3 intentos de bateo | 0, `no_participation` |
| Cupo de tres partidas premiadas agotado | 0, `daily_limit`; la partida sigue siendo jugable |
| Abandono o expiración | Sin cierre premiado |

Puntuación interna: normal 10, perfecto 20 total, fallo 0; no es saldo. No se modifican precios ni inventario. Un cierre válido sin premio registra un evento de cero puntos para conservar su decisión, sin consumir un cupo positivo.

Cupo: tres eventos positivos de `game_beta_completion` por usuario y día de **America/Mexico_City**, compartido por ambos modos. El día se decide después de adquirir el bloqueo económico y se persiste como `reward_day`. El contador consulta ese día persistido, evitando depender del timestamp de inicio de una transacción que pudiera cruzar medianoche. Un cierre sin premio por límite no se canjea al día siguiente mediante reintento.

La economía oficial se habilita en configuración canónica; el generador de práctica siempre publica `enabled:false`. Si una partida nació con economía desactivada, SQL la cierra con estado `disabled` y cero puntos. El protocolo SQL `beta-1` fija las cantidades/reglas aprobadas como defensa; cambiar reglas oficiales requiere actualizar/versionar SQL y configuración juntos, no editar sólo una tarifa del frontend.

## 7. Atomicidad e idempotencia

`game_beta_command` adquiere `profiles FOR UPDATE → activity_attempts FOR UPDATE`. Así serializa cierres y compras del mismo usuario con el orden ya usado por la economía. El índice parcial impide otra beta activa. Las claves de inicio se derivan con `reward_operation_key`; cada comando guarda huella de acción/revisión/pitch/nonce. Reutilizar clave con otra operación produce conflicto.

Para cierre, sólo una secuencia `ready` derivada por SQL entra en la fase interna `settling`, dentro de la misma transacción. Un trigger puente permite que **`complete_activity_attempt` existente** cambie intento a completed, inserte `reward_events` y actualice saldo. `settling` no se publica ni queda confirmado si hay error: todo hace rollback. No hay una segunda implementación de crédito ni una nueva tabla económica.

La clave económica es estable por usuario, operación y UUID de partida, independientemente de los headers que el cliente reintente. El índice único por recurso de Fase 1 añade defensa. El trigger de recompensas conserva el bloqueo legacy y permite beta sólo con fase/status completos, usuario correcto, tipo `game_beta_completion`, importe derivado y clave SQL esperada. El RPC genérico no puede completar una beta pendiente ni otorgarle puntos arbitrarios.

Una respuesta perdida después del commit se resuelve con la misma operación o GET; el mismo `event_id` y decisión se conservan. El saldo devuelto al consultar es el saldo actual, que puede incluir compras posteriores al premio.

## 8. Límites y seguridad proporcionada

- Una beta activa por usuario; vencimiento absoluto a los 8 minutos, también pausada.
- Hasta 30 inicios oficiales por hora, 20 pausas por partida y 128 claves de comandos. Las lecturas no generan premios.
- Máximo 10/15 resoluciones según modo; un pitch acepta una sola resolución. UUID/nonce/revisión y horario son del servidor.
- Sólo `service_role` ejecuta los RPC. Anon/authenticated no escriben intentos/eventos/saldo. Se mantiene RLS y no se expone la clave privada al navegador.
- Cupo diario bajo el mismo bloqueo que saldo y premio. Sin recompensas retroactivas de práctica, abandonos o expiraciones.

**No es prueba de humanidad.** Un bot puede observar el plan público y automatizar swings válidos; el propio QA de navegador lo demuestra. No se afirma que una nonce o una duración lo impidan. El protocolo prueba eventos recibidos a tiempo y deriva su consecuencia; bloquea el score/victoria/premio arbitrario. El daño económico del juego se acota a **180 puntos internos/día/cuenta** con estas reglas. Multi-cuenta, automatización sofisticada y jitter requieren seguimiento/política adicional antes de ampliar premios. No hay premios monetarios ni se ha certificado un sistema antifraude absoluto.

La participación mínima de tres swings, zona diaria, TTL y límites operativos son decisiones técnicas explícitas de esta beta. Deben recibir revisión de producto antes de publicar.

Se comprobó además la práctica de una persona autenticada: badge de práctica, instrucciones correspondientes y pausa local, sin abrir otra partida oficial ni entregar puntos. Las comprobaciones de texto cambiado no encontraron patrones de claves privadas/JWT embebidos; esto no equivale a una auditoría externa. El manifest de credenciales locales de QA se eliminó al cerrar los servicios temporales.

## 9. SQL y procedimiento futuro

Nueva migración única `20261028000100_game_beta_authority.sql`: dos columnas de intentos, restricciones/índices, contador diario indexado, `beta_resolve`, `game_beta_command`, trigger puente y ampliación del guard de recompensas. Las **22 migraciones previas no se renombraron, editaron ni eliminaron**. Se probó creación limpia y upgrade histórico preservando IDs, datos editoriales, saldo, inventario y reintentos antiguos.

No se aplicó a Supabase remoto. Para Prompt 4: revisar diff/migración, respaldar y contrastar historial del entorno objetivo, aplicar sólo esta migración pendiente por el proceso habitual, desplegar backend con reglas coincidentes y después frontend, verificar Auth/CORS/config pública y ejecutar humo con cuentas de prueba autorizadas. No ejecutar reset remoto ni publicar los servidores `checks/`. Esta secuencia está documentada; no fue ejecutada.

## 10. Pruebas ejecutadas

| Comprobación real | Resultado |
| --- | --- |
| Backend pytest | **145/145**, sin fallos/skips; 27 nuevos de beta. Advertencia heredada Starlette/TestClient/HTTPX. |
| Frontend `npm test` | **126/126**, sin fallos/skips; 9 casos nuevos de cliente oficial. Incluye 31 casos locales heredados ignorados y 95 de checks versionables. |
| Build | Config pública de práctica, Tailwind, bundle Supabase y runtime config aprobados. |
| DB limpia y upgrade, Docker/Supabase locales desechables | **406 aserciones pgTAP** existentes: 203 en cada entorno. |
| SQL beta | **74 comprobaciones**: 37 por entorno; ambas modalidades, 50/60/10/0, cupo/día persistido, expiración, abandono, roles, identidad, fraude genérico, rollback y compra. |
| Concurrencia real PostgreSQL | **48 escenarios**: 7 económicos + 7 legacy game + 5 AR + 5 beta, repetidos en ambos entornos. Beta incluye doble cierre, inicio repetido, dos inicios distintos, doble swing y cierre simultáneo con compra. |
| HTTP nuevo con Auth real, ASGI, PostgREST y DB | **94 comprobaciones**: 47 por entorno. Token ausente/inválido, ajeno/inexistente, resultado manipulado, finalización prematura, cinco swings con tiempo real, premio 60 persistente, reintentos, recuperación y saldo visto por otro cliente. |
| HTTP previo | 34 comprobaciones legacy y recorrido AR, repetidos en ambos entornos; sin relajar guards. |
| Navegador integrado con stack real | Auth local real; victoria de cinco perfectos; respuesta del cierre descartada tras commit y recuperada; saldo 250 = 190 sintéticos + 60 ganados; compra existente de Sultanes por 250; saldo/inventario persistentes tras recarga y otra pestaña. |
| Regresión invitado | 15 aserciones de recorrido y 7 de entradas/SPA aprobadas, interfaz/motor reales con reloj determinista, sin premio. |

En el navegador se jugaron también las victorias segunda, tercera y cuarta. Las tres primeras dieron 60 cada una; la cuarta siguió siendo jugable y terminó con `daily_limit`, +0 y saldo 120. Una quinta partida se pausó, reanudó y abandonó sin premio. Conciliación final esperada/verificada en evidencia DB: financiación sintética 190 + premios 180 − compra 250 = **120**, una carta, cuatro eventos de cierre (tres positivos y uno cero). La carta comprada en la primera victoria no desapareció al jugar más partidas.

Los servidores temporales y los stacks desechables de estas pruebas quedaron cerrados. Se conservó el stack Supabase local preexistente del usuario.

El runner `phase04_database.py` sólo acepta proyectos propios desechables, no enlazados, en `.tmp/`; elimina ajustes de conexión remota de sus procesos hijos. Usa CLI y Docker instalados, sin instalar paquetes. Los tests SQL desplazan deadlines **sólo dentro de fixtures SQL sintéticas** para verificar muchas secuencias rápidamente. Los 94 checks HTTP y el navegador usan tiempo real sin esos desplazamientos. No se deben confundir ambos tipos de evidencia.

Comandos desde la raíz:

```powershell
.\backend\venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider
.\backend\venv\Scripts\python.exe backend/checks/phase04_database.py
```

Desde frontend: `npm test`, `npm run build`. Navegador real: iniciar `backend/checks/phase04_live.py`; cuando anuncie READY, ejecutar `node frontend/checks/phase04-official-preview.cjs` y abrir `http://127.0.0.1:4211/__review`. Todo es loopback y usa una cuenta sintética propia. El manifest con credenciales **exclusivamente locales de QA** queda ignorado en `.tmp`, no se publica ni se incluye en evidencias. Crear `.tmp/phase04-live/STOP` finaliza el backend/stack propio y guarda conciliación sin credenciales. No se detiene el stack local preexistente del usuario.

## 11. Evidencia y fallos intermedios

`docs/evidencias/fase04-backend/` contiene stdout final de DB, suites, capturas, recorrido, persistencia visible, consola sin filtros y conciliación final del navegador. La evidencia distingue cuenta/fondos sintéticos, reloj real, automatización de UI y fixtures deterministas.

Hubo tres fallos iniciales de la herramienta SQL de pruebas, conservados en logs separados: desplazamiento del reloj en una llamada diferente hacía vencer el pitch antes del swing; un contador incluía el evento inicial de financiación; se intentó insertar dos veces al mismo usuario sintético. Se corrigieron las fixtures (reloj+acción en una llamada, filtro de evento y reutilización del usuario), sin fingir aprobados esos intentos ni modificar el producto por esos errores. La ejecución final limpia y upgrade terminó aprobada.

Se corrigió además en el cliente oficial la conciliación de pausa/reanudación cuando vence un pitch mientras cambia la revisión; el caso nuevo lo verifica. No se filtraron errores globales de consola ni se modificaron dependencias vendorizadas para ocultarlos. El antecedente de MutationObserver de Fase 2B sigue documentado allí; la consola de esta ejecución se conserva tal como la entregó el navegador.

Consolas capturadas: revisión oficial con stack real, página directa, pausa/abandono y pestaña de Colección sin entradas; la revisión determinista de invitado conserva **una** entrada del TypeError de MutationObserver del contexto de iframe. No se declara reparado ni se atribuye sin pila; continúa la investigación externa ya descrita en [Fase 2B](fase-02b-validacion-observer.md).

## 12. Pendientes y aceptación

- Medir umbrales/compensación/jitter en staging y conexiones reales; Android/iOS/Safari, segundo plano/bfcache, tacto y movimiento reducido físico. Las medidas responsive anteriores son viewports de navegador, no hardware.
- Revisar política de automatización/multi-cuenta y participación mínima. El protocolo de esta beta no demuestra humanidad.
- Publicar/migrar/validar configuración y observabilidad de producción en Prompt 4, con autorización posterior. No se afirma que el backend publicado actualmente ya tenga estos endpoints.
- La UI ofrece recuperación de la última partida; un historial visual completo de partidas antiguas no forma parte de esta fase. Cada UUID/evento sigue consultable por su propietario.
- El registro de comandos vive en JSONB limitado a 128 claves y cada historial a 15 entradas. Revisar retención/limpieza a escala antes de uso prolongado; no se borraron datos actuales.

Checklist:

- [x] Identidad JWT, propiedad y contratos estrictos; no score/resultado/puntos del cliente.
- [x] Secuencia, horario y resultados derivados por servidor; prácticas separadas.
- [x] Recompensa mediante ledger/saldo/RPC existentes, atómica e idempotente.
- [x] Cupo compartido por modo, fecha persistida, expiración y abandono seguros.
- [x] Recuperación y otra pestaña sin repetir el crédito.
- [x] Saldo utilizable en la compra actual y carta persistente sin alterar Colección.
- [x] Suites, SQL limpio/upgrade, concurrencia, HTTP con Auth real y navegador ejecutados.
- [ ] Medición física/staging, revisión de producto y aprobación de publicación.
- [ ] Prompt 4: migración/despliegue autorizados; no ejecutados aquí.

**Recomendación:** continuar con revisión de integración local. La publicación debe esperar la revisión de la migración, límites de beta y matriz externa indicada; el trabajo local no requiere conceder premios basándose en afirmaciones del navegador.
