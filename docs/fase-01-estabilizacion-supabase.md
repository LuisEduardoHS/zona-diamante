# Fase 01 — Estabilización de Supabase, transacciones y recompensas

Fecha: 24 de octubre de 2026. Rama: `feat/collection-cards`. Commit base: `611822e`.

**Estado: PARCIAL.** Los cambios locales y las pruebas están preparados; pasan las regresiones disponibles. La reconstrucción, actualización, permisos efectivos y concurrencia de PostgreSQL **no se ejecutaron** porque el motor Docker no está disponible y no se encontró PostgreSQL local. No se consideran aprobados los criterios que requieren SQL real.

## 1. Resumen de la fase

Se implementaron correcciones para H01–H03 conservando la arquitectura existente y los contratos HTTP/RPC:

- Una migración nueva intercalada antes del catálogo crea los cuatro equipos por slug si faltan. No se editó, renombró ni borró ninguna de las 18 migraciones de `611822e`.
- El seed ahora es repetible y rellena sólo campos editoriales nulos. Conserva IDs, nombres, contenido ya mantenido e `is_active`.
- PostgreSQL construye las claves de operación con usuario, tipo de operación/actividad y solicitud. El cliente sigue enviando su identificador de solicitud mediante `Idempotency-Key`; no elige la identidad económica interna.
- Se separan las versiones 1 y 2 de idempotencia sin reescribir claves ni eventos históricos. Se conserva unicidad efectiva en ambos espacios, más índices únicos por recurso nuevo.
- Reintentos comprueban identidad con `IS DISTINCT FROM`, forma del evento, estado del recurso y resultados originales. Una compra no se interpreta como trivia ni viceversa.
- Compra, finalización genérica y finalización diaria usan orden de bloqueos compatible. Inventario, saldo, intento y ledger permanecen en transacciones SQL.
- Se agregaron 81 aserciones pgTAP y un runner aislado para instalación limpia, actualización con historial anterior y siete escenarios concurrentes. Se agregaron 19 pruebas Python de contratos públicos y detección de resultados incompletos del runner.

No se implementaron colección frontend, AR, juego, partidos ni cambios de economía. Equipo sigue costando 250, jugador 300, figura 500 y mascota sólo AR. No se añadieron límites diarios de compra.

## 2. Estado inicial

`git status --short` no mostró cambios al empezar; sólo avisó de acceso denegado a `.pytest_cache` de la raíz. La rama y HEAD coinciden con lo solicitado. Se leyó la auditoría, el esquema, las 18 migraciones, el seed y los productores/lectores de `reward_events`.

Los únicos productores económicos actuales encontrados son las funciones SQL `purchase_card` y `complete_activity_attempt`; `complete_daily_trivia_attempt` llama a la segunda. Python delega en esas RPC y no escribe el saldo directamente. El frontend de trivia conserva los endpoints existentes; no se modificó.

La instalación tiene Supabase CLI 2.118.0 y Python del venv 3.12.14. `docker ps` y el preflight del runner fallaron por ausencia del motor de Docker Desktop Linux. No se encontraron `psql`, `postgres`, `initdb` o `pg_ctl` en PATH ni el directorio habitual de PostgreSQL. No se instaló ni actualizó nada para resolverlo.

Hay un vínculo local a un proyecto Supabase, pero la caché de configuración no contiene historial de migraciones. **No se consultó `supabase_migrations` remoto.** La afirmación de que las migraciones de colección/compra ya están aplicadas proviene de la solicitud del usuario; no es una comprobación independiente. Se siguió la alternativa autorizada de conservar los históricos, usar evidencia local y preparar la revisión remota, sin repararla ni conectarse a producción.

## 3. Análisis de H01

### Problema

La migración `20261016224429_seed_collection_cards.sql` une su catálogo con `teams.slug` y exige 20 cartas. Las migraciones previas no cargaban equipos: el seed lo hacía después. Una migración posterior al catálogo no resolvería una instalación nueva.

### Implementación

`20261016224300_required_collection_teams.sql` se ordena entre el esquema de colección (`20261016224102`) y su catálogo (`20261016224429`). Inserta exclusivamente:

| Slug | Nombre de referencia |
| --- | --- |
| `sultanes-mty` | Sultanes |
| `dorados-chi` | Dorados |
| `charros-jal` | Charros |
| `algodoneros-ul` | Algodoneros |

Usa `ON CONFLICT (slug) DO NOTHING`. Una base existente conserva IDs y todas sus columnas, incluidas modificaciones editoriales. No se fijan IDs ni se reinician secuencias. Como ocurre normalmente con identity+upsert, pueden consumirse valores de secuencia sin crear filas; los IDs existentes no cambian y no se promete que sean contiguos.

En una instalación nueva, la migración del catálogo ya encuentra los equipos, resuelve las FK por slug y crea las 20 cartas. Después `seed.sql` rellena `city`, `zone`, `history`, `colors` y `details` que estén a NULL. En una base inicializada esos campos no se sustituyen. Sólo actualiza `updated_at` si falta alguno de ellos; una segunda ejecución sobre filas completas no las modifica.

El contenido editorial del seed anterior se conserva. No se fusionan ni sobrescriben objetos JSON ya existentes, ni se fuerzan nombres/campos vacíos que sean no nulos. Esto es deliberado: el seed es inicialización conservadora, no un mecanismo para publicar revisiones editoriales sobre datos mantenidos. Los cambios editoriales futuros necesitan una acción explícita distinta.

### Historia de migraciones

La nueva versión intercalada es una **adición intencional a un hueco histórico**, no una renumeración. El código base ya aplicado no se modifica. El verificador local comparó el contenido de los 18 archivos con `git show 611822e:<ruta>`: permanecen iguales. Ahora hay 20 migraciones locales.

En un remoto que ya tenga las 18, la nueva versión anterior al máximo histórico requiere revisión y `--include-all`; no se debe usar `migration repair` para fingir que se ejecutó. El procedimiento de la sección 13 incluye listado, dry-run y aplicación futura controlada. No se ejecutó aquí ninguna de esas operaciones remotas.

La [documentación de seed de Supabase](https://supabase.com/docs/guides/local-development/seeding-your-database) confirma el orden migraciones → seed. La estrategia y los flags también se contrastaron con la ayuda de la CLI instalada.

## 4. Análisis de H02

### Solicitud pública e identidad interna

La firma de compra continúa siendo `purchase_card(uuid, bigint, text)`. El header de FastAPI sigue siendo obligatorio y de hasta 128 caracteres. Python pasa la clave como identificador de solicitud; **PostgreSQL es la única capa que construye su identidad económica**.

La función privada para los roles de cliente `reward_operation_key` calcula:

```text
zd:v2:<user_uuid>:hex(SHA256(UTF8(JSONB([operation, request_key]))))
```

Operaciones:

- Compra: `card_purchase`.
- Finalización: `activity:<activity_type de la fila>:<event_type normalizado>`.

JSONB delimita inequívocamente los campos. SHA-256 es una función nativa de PostgreSQL; no se añadió extensión o dependencia para hashing. Usuario y operación forman parte de la identidad. La carta/attempt **no se incluye en la solicitud de compra/finalización**: se compara contra el evento ya persistido, por lo que reutilizar una clave para otro recurso dentro del mismo espacio produce conflicto, no otra concesión.

El resultado de compra/finalización no devuelve la clave interna ni el request original. No se generan claves secretas o tokens de autorización: la idempotencia nunca sustituye JWT/permisos. El endpoint de historial conserva su contrato existente, filtrado por usuario; puede mostrar la clave de su propio evento como antes, ahora opaca y sin el request original en eventos v2. No contiene credenciales ni concede permiso para ejecutar otra operación. Nunca deben usarse contraseñas/JWT como claves de solicitud.

### Unicidad y protección contra claves históricas arbitrarias

Se añadió `reward_events.idempotency_version SMALLINT NOT NULL DEFAULT 1`, restringida a 1/2. Los datos existentes son versión 1; las dos funciones nuevas escriben explícitamente versión 2.

La unicidad global anterior se sustituye por `UNIQUE(idempotency_version, idempotency_key)`. **No se elimina la unicidad sin reemplazo**:

1. Las claves históricas siguen siendo únicas entre sí y no se reescriben.
2. Las nuevas claves son únicas entre sí y derivadas por el servidor de usuario/operación/solicitud.
3. Una clave v1 elegida arbitrariamente antes del cambio, incluso si coincide literalmente con una clave v2 calculada, no reserva ni bloquea el espacio v2.
4. Un índice único v2 por `(user_id, card_id)` para compras y otro por `(user_id, attempt_id)` refuerzan una sola operación por recurso.

El default 1 mantiene compatibilidad de filas históricas y escritores privilegiados anteriores; las operaciones estabilizadas siempre especifican 2. No debe introducirse otro escritor económico que inserte eventos directamente omitiendo este contrato. Clientes anon/authenticated no tienen permisos de inserción en el ledger.

El estado de intento/inventario y los bloqueos siguen siendo controles obligatorios; los índices no se usan como sustituto de las reglas de negocio.

## 5. Análisis de H03

### Validación de reintentos

La búsqueda comprueba primero la clave v2 en su versión. Sólo cuando no existe considera el request histórico exacto, filtrado por **el mismo usuario y tipo de evento**. Para finalizaciones también separa la actividad original si el intento histórico existe. Una fila con intento nulo no evita la comprobación: falla explícitamente si se pretende tratarla como finalización.

| Caso | Comportamiento implementado |
| --- | --- |
| Misma compra, usuario y request | Devuelve evento original; no vuelve a descontar. |
| Misma clave de cliente, otro usuario | Espacio independiente. No consulta/devuelve el evento ajeno como resultado. |
| Misma clave para otra carta del mismo usuario | Conflicto, sin entrega ni débito. |
| Misma clave para otra operación/actividad | Espacio separado; cada operación debe validar y modificar su propio recurso. |
| Compra histórica con la clave antigua de trivia | Trivia no la acepta como resultado; puede completar su intento y generar su evento correcto. |
| Evento de trivia con el request de compra | No confirma la compra; ésta debe crear su propia operación válida. |
| Evento histórico del mismo tipo con attempt NULL | Se rechaza mediante identidad null-safe; no se completa ni acredita. |
| Reintento de finalización con score/puntos distintos | Conflicto o inconsistencia; no modifica estado. |
| Evento de finalización sin intento completado o inventario ausente para compra repetida | Falla cerrado como inconsistencia. No se “repara” ni concede implícitamente. |
| Nuevo request sobre carta poseída o intento ya completado | Se rechaza como antes; no es otra recompensa válida. |

Se usan `IS DISTINCT FROM` para usuario, tipo, recurso, score/puntos y fecha cuando pueden intervenir NULL. En compra se exige `attempt_id IS NULL`; en finalización `card_id IS NULL` y un intento propio. Un `CHECK` de forma para v2 impide compra con puntos positivos y finalizaciones sin intento o con puntos negativos. La función genérica además rechaza `event_type='card_purchase'`, recompensas negativas y score negativo.

No se reescriben automáticamente estados históricos dañados. Un usuario que ya sufrió una inconsistencia necesita revisión explícita de su ledger/estado, sin repetir débitos/créditos para intentar “arreglar” los datos.

### Atomicidad y concurrencia

Todas las operaciones estabilizadas siguen el orden:

```text
perfil del usuario FOR UPDATE
  → intento FOR UPDATE, si corresponde
    → advisory transaction lock de la clave v2
      → validación completa + escrituras + retorno
```

El perfil serializa operaciones económicas de una cuenta; cuentas distintas no comparten su identidad de bloqueo. Una colisión del hash del advisory lock sólo puede serializar trabajo, no hacer que un evento sea considerado de otra identidad: se compara la clave completa al leer el ledger.

La función diaria también toma primero el perfil. Mantener su orden anterior de intento → perfil mientras la genérica usa perfil → intento introduciría riesgo de deadlock entre dos caminos al mismo intento. Los locks reentrantes dentro de la misma transacción permiten que la diaria llame a la genérica sin invertir ese orden.

Compra realiza inventario, débito y evento dentro de la misma invocación SQL. Finalización realiza cambio de intento, evento y saldo dentro de la misma invocación. Un error intermedio revierte la transacción de la RPC. Esto está implementado y cubierto por pruebas preparadas con trigger de fallo; **no se ha demostrado todavía ejecutándolo en PostgreSQL**.

## 6. Decisiones técnicas y justificación

1. **Añadir dos migraciones, conservar las 18 previas.** Resuelve orden limpio sin cambiar archivos declarados como aplicados. Hace explícita la intervención intercalada y su revisión de despliegue.
2. **Seed conservador.** Upsert por slug rellena NULL y conserva edición existente; nunca trunca datos, reasigna IDs o borra equipos.
3. **Namespace en PostgreSQL.** Evita duplicar reglas entre Python y SQL y protege llamadas privilegiadas directas a las RPC, no sólo la ruta HTTP.
4. **Versionar sin transformar las claves existentes.** Evita que una cadena histórica arbitraria pueda reservar una clave interna futura y conserva trazabilidad/compatibilidad de reintentos.
5. **No añadir columnas request en texto claro.** Usuario, evento, recurso, metadata y versión mantienen trazabilidad; el digest permite correlacionar un request conocido sin almacenarlo de nuevo. El historial previo conserva sus valores existentes.
6. **Locks del perfil antes de intento/request.** Orden consistente para compras, créditos y la combinación diaria/genérica. No se concedió UPDATE sobre catálogo para poder bloquearlo: compra lee la disponibilidad/precio en su snapshot después de bloquear el perfil, como política de compra de esta fase. Si luego hay edición concurrente de precios con garantías más fuertes, requerirá su propio protocolo editorial.
7. **Mascotas protegidas también en SQL.** Un CHECK y comprobación explícita de compra refuerzan la regla solicitada. Si un remoto tiene una mascota mal configurada, la nueva migración debe fallar para revisión; no cambia sus datos silenciosamente.
8. **Errores públicos genéricos.** Se mapean inconsistencias a HTTP 409 sin IDs, claves ni mensajes internos ajenos. Los errores desconocidos conservan el 502 genérico.
9. **No reparar ni consultar producción por aproximación.** El historial remoto sigue pendiente; no se usaron credenciales de `.env` ni se enviaron consultas SQL remotas. No se decidió una reparación de historial sin evidencia.
10. **Runner sin drivers nuevos.** Usa CLI ya instalada, Docker y el psql del contenedor; no instala paquetes. Su preflight bloqueado devuelve 2 y no cuenta como test aprobado.

## 7. Archivos creados y modificados

Rutas relativas a `D:\projects\zona-diamante`.

| Tipo | Archivo | Cambio |
| --- | --- | --- |
| Modificado | `supabase/seed.sql` | Upsert conservador/repetible de los cuatro equipos; contenido previo intacto. |
| Modificado | `backend/app/api/routes/cards.py` | Inconsistencia económica → 409 con mensaje seguro. |
| Modificado | `backend/app/services/trivia.py` | Colisión/inconsistencia de finalización → error de dominio 409 seguro. |
| Nuevo | `supabase/migrations/20261016224300_required_collection_teams.sql` | Referencias por slug antes del catálogo. |
| Nuevo | `supabase/migrations/20261024000100_isolate_reward_idempotency.sql` | Versionado, unicidad, helper, RPC y restricciones económicas. |
| Nuevo | `supabase/tests/database/phase01_economy_test.sql` | 81 aserciones preparadas: economía, historial, NULL, roles, RLS y rollback. |
| Nuevo | `backend/checks/phase01_database.py` | Entornos desechables clean/upgrade, pgTAP, seeds y siete escenarios concurrentes reales. |
| Nuevo | `backend/tests/test_phase01_api.py` | 10 casos Python de identidad autenticada, headers, errores y filtro de historial. |
| Nuevo | `backend/tests/test_phase01_check_runner.py` | 9 casos para que TAP fallido, omitido o incompleto nunca pase. |
| Nuevo | `docs/fase-01-estabilizacion-supabase.md` | Este informe y procedimiento de revisión. |

El build regeneró únicamente los outputs ignorados habituales. No se modificaron HTML/JS/CSS fuente, manifiestos/lockfiles de dependencias, el informe histórico de auditoría, configuración del hosting ni migraciones previas.

## 8. Cambios de esquema, funciones, permisos y contratos

### Esquema

- `reward_events.idempotency_version`, default 1, CHECK 1/2.
- Reemplazo de `reward_events_idempotency_key_key` por `reward_events_version_key_unique` sobre versión+clave.
- CHECK de forma económica de eventos v2 y dos índices únicos parciales por recurso.
- CHECK `cards_mascot_ar_only_check`; además se conserva el CHECK anterior que exige costo cero para AR.
- Sin cambios a FK, PK, campos de precios/saldo ni definición de permisos RLS existentes.

### Funciones

- Nueva `reward_operation_key(uuid,text,text)`, SQL, immutable/strict, `search_path=pg_catalog`.
- Reemplazo por migración nueva de `purchase_card(uuid,bigint,text)`.
- Reemplazo por migración nueva de `complete_activity_attempt(uuid,uuid,text,text,integer,integer,jsonb)`.
- Reemplazo por migración nueva de `complete_daily_trivia_attempt(uuid,uuid,uuid,date)` para validación de identidad no nula, fecha null-safe y orden de locks. Se conserva el cálculo diario existente.

Las funciones económicas continúan siendo **SECURITY INVOKER**, con `search_path` explícito. La nueva función helper y las tres RPC económicas revocan EXECUTE a PUBLIC/anon/authenticated y lo conceden sólo a service_role. No se añadió ningún permiso de tabla ni se amplió el acceso del navegador. La capacidad real de service_role y las denegaciones se comprobarán ejecutando SQL bajo esos roles; no se certifican a partir del GRANT escrito.

### API y frontend

No cambian endpoints, parámetros de RPC, header, precio, score ni campos de respuesta de compra/trivia. El balance devuelto en reintento es el **saldo actual**, como antes, no una instantánea del saldo de la compra original. El `reward_id` y `points_delta` corresponden al evento original.

Sólo se añaden traducciones seguras de conflictos de integridad a 409. No se usa el user_id/costo/puntos que un cliente introduzca en el body de compra; la identidad sigue viniendo del JWT validado. No se duplicó el cálculo de claves, precios o premios en Python.

## 9. Compatibilidad con datos y migraciones anteriores

- Los 18 archivos de migración de `611822e` conservan su contenido versionado. Los IDs de equipo/carta/usuario, FKs e inventario existentes no se reescriben.
- La adición del campo versión hace que el historial existente se interprete como v1, manteniendo claves, metadata y valores económicos anteriores.
- Reintentos históricos válidos se reconocen dentro de su usuario/tipo/recurso y devuelven el evento anterior sin crédito/débito nuevo.
- Colisiones históricas entre tipos/usuarios no se convierten en resultados idempotentes; pueden dar lugar a una **nueva operación legítima en su propio espacio**, siempre que su recurso/estado sean válidos. Reusar una clave para otro recurso del mismo espacio se rechaza.
- Eventos históricos inconsistentes permanecen visibles para auditoría y provocan fallo cerrado cuando afecten la operación. No hay limpieza ni reparación automática de datos reales.
- La nueva restricción de mascotas se valida durante la migración. Si existen excepciones reales, detener el rollout y revisar los datos; no desactivar el CHECK ni cambiar la carta automáticamente.
- Los índices únicos nuevos se aplican a v2; no intentan deduplicar retrospectivamente eventos v1. La migración no certifica que el ledger histórico ya sea correcto.
- El runner incluye una actualización reproducida desde las 18 migraciones originales: primero las 13 previas a colección y seed original, después las cinco de colección originales; crea compras/créditos v1 y edición editorial, aplica las dos nuevas con `--include-all` y compara snapshots/reintentos. **Ese recorrido está preparado, no ejecutado en esta máquina**.
- Antes de aplicar el cambio, se deben drenar solicitudes económicas en curso. No se garantiza despliegue sin pausa con RPC antiguas ya ejecutándose durante el cambio de esquema/locks.

## 10. Pruebas ejecutadas, comandos y resultados

### Resultados finales disponibles

| Comprobación | Resultado observado | Alcance |
| --- | --- | --- |
| `git status --short`, rama y log | Inicial limpio; rama `feat/collection-cards`, base `611822e`. | No fetch ni cambio de rama. Warning previo de caché raíz. |
| Desde `backend`: `.\venv\Scripts\python.exe -m pytest -q -p no:cacheprovider` | **62 passed**, una advertencia de deprecación Starlette/HTTPX, cero fallos/omitidas. | Incluye 43 anteriores + 19 nuevas. Dobles de API/servicios y parser del runner; no PostgreSQL. |
| `npm --prefix frontend test` | **38 passed**, cero fallos/omitidas. | Regresión local existente, incluidos tests locales ignorados ya descritos en la auditoría. No se cambió esa situación fuera de alcance. |
| `npm --prefix frontend run build` | CSS, bundle Supabase y runtime config completados. | Dependencias existentes; no instalación, actualización ni despliegue. |
| Comparación local de 18 históricos contra `git show 611822e:<ruta>` | Los **18 coinciden**; 20 migraciones presentes; bootstrap ordena antes del catálogo. | Verificación de archivos, no de historial remoto/aplicación SQL. |
| `ast.parse` de los tres archivos Python nuevos | Correcto. | Sintaxis Python; el runner aún no ejecuta su camino con Docker. |
| Parser TAP: prueba de plan correcto y ocho resultados fallidos/incompletos | 9 casos pasan dentro de pytest. | Evita falsos positivos de skips/TODO, plan ausente, números duplicados, fallos y abortos. No sustituye pgTAP real. |
| Ayuda de CLI para migration up/list, start/stop, test db y db push | Flags locales, `--include-all`, `--dry-run` y `--no-backup` disponibles en 2.118.0. | Sólo ayuda; no consultas/mutaciones remotas. Aviso de nueva CLI ignorado, sin actualizar. |
| `git diff --check` | Sin errores de whitespace en cambios versionados. | Revisión textual, no SQL compilado. |
| `docker ps` y `docker info` del runner | Motor Docker no disponible. | No se iniciaron contenedores. |
| `.\backend\venv\Scripts\python.exe backend/checks/phase01_database.py` | **Exit 2: BLOCKED**, “Docker engine unavailable; no SQL/migration/concurrency test executed”. | Se verificó el returncode real con subprocess. Ningún entorno desechable ni fixture SQL fue creado. |

Durante el trabajo se ejecutaron primero 53 pruebas Python y luego la suite final de 62 tras añadir los tests del parser. Ambos resultados fueron verdes. No se presenta la suma de las ejecuciones como cobertura adicional.

### Cómo ejecutar la validación real preparada

Con Docker Desktop disponible y la CLI ya instalada, desde la raíz:

```powershell
.\backend\venv\Scripts\python.exe backend/checks/phase01_database.py
```

El runner no recibe DSN, contraseña, URL o selector remoto. Genera proyectos `zd_phase01_clean_<id>` y `zd_phase01_upgrade_<id>` bajo `.tmp`, sin copiar `.env`, `.temp` ni vínculos del proyecto original. Cambia los puertos a puertos locales libres. Quita variables de conexión/autenticación remota del entorno de sus subprocesos y usa `--local` para reset/up. Sólo se conecta con psql mediante `docker exec` al contenedor derivado del ID creado por él.

Usa los servicios Supabase necesarios para obtener esquemas Auth/Storage reales y no un mock de esas tablas. `supabase start` puede necesitar imágenes Docker del proveedor; no instala pip/npm ni actualiza la CLI. Si falta una imagen y no se desea descargarla, preparar primero las imágenes autorizadas. En esta ejecución no se llegó a ese punto.

Cada entorno comprueba seed repetido, los 14 tests SQL existentes y los 81 nuevos. También ejecuta siete escenarios de sesiones PostgreSQL separadas:

1. Misma compra/request concurrente: un evento y un reintento.
2. Dos cartas con saldo para una sola: un éxito, un saldo insuficiente, sin sobregiro.
3. Misma carta con claves distintas: un éxito y un rechazo de propiedad.
4. Dos finalizaciones diarias concurrentes: un crédito y un reintento.
5. Compra y trivia concurrentes usando el mismo hint de solicitud: dos operaciones independientes y saldo combinado correcto.
6. Finalización diaria y genérica del mismo intento: una sola concesión, sin inversión de locks.
7. Dos finalizaciones genéricas concurrentes: un único crédito.

El runner verifica balance contra suma del ledger, cantidad de inventario/eventos y estado final del intento. Los locks se mantienen hasta el commit durante la carrera. El SQL de pgTAP fuerza además errores de inserción mediante trigger para comprobar rollback de escrituras anteriores.

La limpieza usa `stop --project-id <ID creado> --no-backup` exclusivamente después de validar prefijo, carpeta y marcador desechable. No usa `--all`, no detiene el proyecto original y no hace borrados recursivos de carpetas. Los archivos de trabajo quedan ignorados bajo `.tmp` para inspección. Si falla la limpieza se informa el ID exacto del proyecto de pruebas; el recorrido normal exige parar ambos antes de declarar éxito.

Interpretar salidas:

- **0:** todas las comprobaciones de ambos entornos finalizaron correctamente.
- **1:** fallo de infraestructura, migración, aserción, concurrencia o limpieza; revisar antes de entregar.
- **2:** precondiciones ausentes; pruebas de BD bloqueadas, no aprobadas.

## 11. Pruebas no ejecutadas y motivo

| Pendiente | Motivo |
| --- | --- |
| Compilación/ejecución de las funciones y constraints SQL nuevas | No hay PostgreSQL ni Docker operativo. La lectura textual no acredita compilación PL/pgSQL. |
| Supabase limpio, reset local desechable y seed doble | Runner se detuvo en preflight. No se reseteó ninguna BD existente. |
| Upgrade con las 18 migraciones históricas y datos previos | Mismo bloqueo. Preparado como segundo entorno aislado. |
| 81 aserciones pgTAP nuevas y 14 existentes | Mismo bloqueo; no se contabilizan como aprobadas. |
| Siete carreras reales por entorno | Mismo bloqueo; pruebas Python unitarias no simulan su aprobación. |
| Permisos/RLS efectivos con anon/authenticated/service_role | Se preparó SQL que cambia de rol; no se ejecutó. |
| Historial de migraciones y estado de datos del remoto | No se accedió a producción; la evidencia local no lo acredita. |
| Flujo Auth+HTTP+PostgREST real con cuentas de prueba | No se creó entorno completo ni se usaron usuarios reales. Las nuevas pruebas HTTP usan dependencia Auth sustituida. |

## 12. Riesgos que permanecen

- **La fase no está validada completamente.** Puede haber errores SQL, de permisos de la plataforma o del recorrido de infraestructura que sólo aparecerán al ejecutar el runner real. No integrar ni publicar basándose únicamente en 62 tests Python verdes.
- El historial remoto puede diferir del conjunto local. El rollout depende de revisarlo y confirmar que el dry-run sólo propone las dos migraciones nuevas previstas.
- Datos v1 corruptos, débitos/créditos sin ledger, intentos con estados erróneos o mascotas mal configuradas necesitan revisión manual separada. No se modificaron ni se corrigieron datos reales.
- La API conserva el contrato del historial propio; consumidores futuros no deben tratar claves del ledger como autorización ni construir su propio namespace.
- Una clave reutilizada dentro del mismo tipo/usuario para otro recurso falla; entre tipos tiene independencia deliberada. No es una clave global que identifique todas las acciones de un usuario.
- El ledger por defecto v1 permite interoperabilidad con escritores privilegiados antiguos; no se deben añadir escrituras directas nuevas que eludan las RPC v2.
- Las actividades genéricas no validan reglas de juego/AR aún inexistentes. Sólo el backend privilegiado debe decidir score/puntos después de validar la actividad. Esta fase no convierte metadata del navegador en prueba fiable de participación.
- H06 (identidad/día de trivia al cruzar medianoche), límites de intentos, y el resto de hallazgos de la auditoría siguen fuera de alcance. Sólo se corrigió en trivia lo necesario para integridad de esta fase: locks, null-safe y errores.
- El CHECK de forma v2 permite finalizaciones de puntos sin carta y compras de carta con débito. Una futura recompensa AR que conceda carta+intento deberá extender explícitamente la regla de forma con sus pruebas; no usar un evento de compra para representarla.
- No se cambiaron dependencias ni el advisory de tooling existente. La advertencia TestClient/HTTPX sigue presente.

## 13. Procedimiento propuesto de despliegue, no ejecutado

**No ejecutar este procedimiento hasta revisar el reporte, completar la validación local y autorizar el acceso/aplicación remota.** No implica permiso para borrar datos, marcar migraciones como aplicadas o cambiar de rama.

1. Ejecutar el runner local hasta exit 0 y conservar salida de los dos entornos. Revisar SQL y el diff completo, incluidos archivos nuevos.
2. Identificar el remoto correcto y disponer de respaldo/plan de recuperación. Preparar una ventana sin operaciones económicas en curso; no mezclar RPC viejas/nuevas durante la transición.
3. Consultar sólo el historial con la CLI instalada, en un entorno autorizado, sin imprimir secretos:

   ```powershell
   .\node_modules\.bin\supabase.cmd migration list --linked
   ```

   Confirmar las versiones realmente aplicadas y que los 18 archivos locales corresponden. Si falta alguno o hay discrepancias, detener el procedimiento y revisar; no ejecutar `migration repair` por aproximación.

4. Revisar datos mediante consultas **de lectura** en el entorno autorizado. Por ejemplo, sin exportar IDs/keys de usuarios:

   ```sql
   begin read only;
   select version from supabase_migrations.schema_migrations order by version;
   select slug, count(*) from public.teams group by slug order by slug;
   select count(*) as invalid_mascots from public.cards
     where card_type = 'mascot' and (unlock_method <> 'ar' or cost <> 0);
   select count(*) as invalid_purchase_events from public.reward_events
     where event_type = 'card_purchase'
       and (attempt_id is not null or card_id is null or points_delta > 0);
   select count(*) as mismatched_attempt_owners from public.reward_events e
     join public.activity_attempts a on a.id = e.attempt_id
     where e.user_id is distinct from a.user_id;
   rollback;
   ```

   Una anomalía no autoriza una reparación automática. Revisarla con el equipo y preparar su propia corrección, sin repetir recompensas.

5. Inspeccionar qué se aplicaría, incluyendo la versión intercalada anterior al máximo remoto:

   ```powershell
   .\node_modules\.bin\supabase.cmd db push --linked --include-all --dry-run
   ```

   Con las 18 originales presentes, el resultado esperado contiene sólo `20261016224300` y `20261024000100`. Si propone más, detenerse. No se usa `--include-seed`: el seed conservador se probó localmente y la migración bootstrap no sustituye edición remota.

6. **Sólo después de autorización específica para aplicar**, ejecutar el mismo plan sin `--dry-run`:

   ```powershell
   .\node_modules\.bin\supabase.cmd db push --linked --include-all
   ```

   No se ejecutó este comando durante la fase. No modificar/renombrar las migraciones originales ni marcar la nueva como aplicada sin ejecutarla.

7. Volver a consultar historial, comprobar constraints/permisos/versiones de funciones y realizar smoke tests autorizados con cuentas de pruebas. No usar usuarios reales para forzar compras o créditos. El código HTTP puede desplegarse por separado después de validar las RPC; esta fase no realizó despliegues.
8. No hacer rollback borrando ledger/columna versión o reactivando las RPC vulnerables. Un fallo posterior requiere corrección hacia adelante y revisión de los eventos v2 ya creados. Conservar respaldo y salida de validación.

La [referencia oficial de CLI](https://supabase.com/docs/reference/cli/supabase-db-push) y la ayuda de 2.118.0 permiten revisar los flags; no sustituyen confirmar proyecto e historial reales.

## 14. Checklist de aceptación de la fase

- [x] Rama/base y estado inicial verificados; sin descartar trabajo ajeno.
- [x] Los 18 históricos conservan su contenido versionado.
- [x] Migración de referencia ordenada antes del catálogo, por slugs estables.
- [x] Seed repetible conservador implementado, sin cambiar textos/precios/IDs existentes.
- [x] Separación de usuario/operación/versiones y validación NULL-safe implementadas en SQL.
- [x] Permisos de RPC restringidos; sin nuevos grants amplios de tabla.
- [x] Firmas HTTP/RPC y reglas de puntos/precios conservadas.
- [x] 62 pruebas Python y 38 frontend pasan; build completo pasa.
- [x] Pruebas SQL, rollback, roles y concurrencia preparadas con entorno seguro y fallo explícito si no hay Docker.
- [ ] Instalación limpia ejecutada con cuatro equipos, 20 cartas, cinco por equipo y slugs únicos.
- [ ] Dos ejecuciones adicionales del seed comprobadas en PostgreSQL, sin cambios/duplicados.
- [ ] Upgrade desde BD previa ejecutado, con historia, editorial, IDs, saldo, inventario y eventos preservados.
- [ ] Reintentos v1/v2, colisiones, NULL, rollback y estado de intentos comprobados con SQL real.
- [ ] Concurrencia de compra/trivia comprobada sin sobregiro ni doble acreditación.
- [ ] Permisos/RLS efectivos y rechazos reales bajo los tres roles comprobados.
- [ ] Historial y preflight remoto revisados antes de cualquier propuesta final de aplicación.

La falta de los checks SQL mantiene el estado **PARCIAL**, aunque el trabajo local de implementación/documentación esté preparado para revisión.

## 15. Recomendaciones antes de integrar el frontend de colección

1. Revisar `20261024000100_isolate_reward_idempotency.sql`, especialmente la compatibilidad v1/v2, la unicidad y los locks de la diaria/genérica. Revisar también la migración intercalada y el seed conservador.
2. Ejecutar el runner real y corregir cualquier fallo hasta exit 0 en clean y upgrade. La cuenta de 81 aserciones es una inspección del archivo, no un resultado de PostgreSQL.
3. Confirmar historial remoto y anomalías del ledger antes de planificar aplicación; no usar el frontend nuevo como herramienta para descubrir errores transaccionales en producción.
4. Mantener la clave de solicitud por intento de compra en la UI para poder reintentar una respuesta perdida. No generar una nueva clave al pulsar Reintentar para la misma operación pendiente, ni reutilizarla deliberadamente para otra carta.
5. Mostrar el `points_balance` de la respuesta y reconciliar al recargar. Tratar 409 como conflicto que requiere refrescar/explicar el estado, sin anunciar compra ni descontar localmente antes de confirmarla.
6. Mantener mascotas exclusivamente AR y ownership derivado del servidor. No conceder cartas por toggles del navegador, score local o confeti.
7. Revisar en otra fase la identidad del intento/día de trivia, el arte/catálogo y los demás pendientes de la auditoría. No ampliar esta migración para diseñar el juego o el protocolo de prueba física AR.

No se hicieron commits, push, merges, cambios de rama, despliegues, instalaciones ni escrituras/reparaciones remotas.
