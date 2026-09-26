# Plan de backend, base de datos y despliegue de Zona Diamante

## 1. Decisión técnica

Zona Diamante usará una arquitectura híbrida:

- **PostgreSQL administrado por Supabase** como base de datos principal.
- **Supabase Auth** para registro, inicio de sesión, recuperación de contraseña y sesiones.
- **Supabase Storage** para fotografías de perfil y, si después conviene, archivos administrables.
- **FastAPI** como backend propio para las operaciones que no deben confiarse al navegador: puntos, resultados, recompensas y desbloqueo de cartas.
- **Netlify** para servir el frontend estático actual.
- **Render o Railway** para ejecutar FastAPI como un servicio persistente.

Supabase y PostgreSQL no son alternativas entre sí: cada proyecto de Supabase incluye una base PostgreSQL completa. Supabase es la plataforma que la administra y agrega Auth, Storage, API y herramientas de despliegue.

### Flujo general

```text
Usuario en el navegador
        |
        v
Frontend estático en Netlify
        |
        |-- Supabase Auth: registro, login y sesión
        |-- Data API + RLS: lecturas permitidas
        |-- Storage: fotografía de perfil
        |
        `-- FastAPI: operaciones sensibles
                  |
                  |-- valida el JWT del usuario
                  |-- comprueba reglas e idempotencia
                  `-- ejecuta una transacción/RPC en PostgreSQL
```

## 2. Por qué PostgreSQL

PostgreSQL encaja especialmente bien porque los datos tienen relaciones claras:

- un usuario puede tener muchas cartas;
- una carta pertenece a un equipo;
- un usuario puede completar muchos intentos;
- cada recompensa debe asociarse con un usuario y un evento;
- una misma recompensa no debe cobrarse dos veces.

Las claves foráneas, restricciones únicas y transacciones permiten aplicar esas reglas en la propia base de datos. Esto es más seguro que mantener puntos e inventarios únicamente en JavaScript o en documentos independientes.

También permite conservar datos flexibles, como información adicional de un evento, mediante `jsonb`, sin convertir toda la base en un modelo no relacional.

## 3. Por qué Supabase

Para el alcance y tamaño actual de Zona Diamante, Supabase es la opción recomendada porque reúne:

- PostgreSQL administrado;
- autenticación y emisión de JWT;
- almacenamiento de archivos;
- Row Level Security (RLS);
- API de datos para el navegador;
- migraciones y desarrollo local con Supabase CLI;
- posibilidad de salir de la plataforma más adelante, porque los datos siguen estando en PostgreSQL.

Supabase no elimina la necesidad de diseñar seguridad. Todas las tablas expuestas deberán tener RLS, permisos mínimos y pruebas de acceso. La llave secreta o `service_role` nunca llegará al frontend.

### Alternativas consideradas

- **PostgreSQL en Render/Railway sin Supabase:** es viable, pero obliga a añadir por separado autenticación, almacenamiento, administración y más código operativo.
- **Neon más un proveedor de Auth y almacenamiento:** ofrece mayor separación de proveedores, pero añade piezas y configuración que el proyecto todavía no necesita.
- **MySQL:** podría resolver el modelo relacional, pero no aporta una ventaja clara frente al PostgreSQL integrado con Supabase.

La decisión se revisará si el proyecto llega a necesitar requisitos regulatorios, infraestructura totalmente autocontrolada, otra región específica o un volumen que justifique separar servicios.

## 4. Estado de partida

Actualmente existe:

- un frontend estático en `frontend/public/`;
- formularios visuales de login y registro;
- datos de equipos en `frontend/public/data/equipos.json`;
- colección, trivia y juego con contenido fijo o simulado;
- un servidor mínimo en `backend/main.py`;
- una lista mínima de dependencias para ejecutar FastAPI, ya depurada de servicios anteriores;
- un despliegue del frontend en Netlify.

Todavía no existe:

- proyecto de Supabase conectado;
- esquema SQL versionado;
- registro o login real;
- backend organizado por módulos;
- validación de JWT en FastAPI;
- persistencia de puntos, intentos o cartas;
- despliegue del backend;
- pruebas de RLS y recompensas.

## 5. Estructura de carpetas objetivo

Trabajaremos desde la raíz del repositorio:

```text
zona-diamante/
|-- backend/
|   |-- app/
|   |   |-- __init__.py
|   |   |-- main.py
|   |   |-- api/
|   |   |   |-- __init__.py
|   |   |   |-- dependencies.py
|   |   |   `-- routes/
|   |   |       |-- health.py
|   |   |       |-- profile.py
|   |   |       |-- attempts.py
|   |   |       `-- rewards.py
|   |   |-- core/
|   |   |   |-- config.py
|   |   |   `-- security.py
|   |   |-- db/
|   |   |   `-- supabase.py
|   |   |-- schemas/
|   |   |   |-- profile.py
|   |   |   |-- attempt.py
|   |   |   `-- reward.py
|   |   `-- services/
|   |       |-- attempts.py
|   |       `-- rewards.py
|   |-- tests/
|   |-- .env.example
|   |-- requirements.txt
|   `-- Dockerfile
|-- frontend/
|   |-- public/
|   |   `-- js/
|   |       |-- api/
|   |       |   |-- backend-client.js
|   |       |   `-- supabase-client.js
|   |       |-- auth/
|   |       |   |-- session.js
|   |       |   `-- guards.js
|   |       `-- ...archivos actuales
|   |-- scripts/
|   |   `-- generate-runtime-config.cjs
|   |-- .env.example
|   `-- package.json
|-- supabase/
|   |-- migrations/
|   |-- tests/
|   |-- seed.sql
|   `-- config.toml
|-- docs/
|   `-- plan-backend-supabase.md
|-- .env.example
|-- .gitignore
`-- README.md
```

### Responsabilidad de cada carpeta

- `backend/app/api/routes/`: recibe y responde solicitudes HTTP.
- `backend/app/services/`: contiene reglas del negocio; las rutas no deben calcular premios directamente.
- `backend/app/schemas/`: valida entradas y respuestas con Pydantic.
- `backend/app/core/`: configuración, seguridad y utilidades compartidas.
- `backend/app/db/`: único lugar desde el que FastAPI crea clientes o conexiones.
- `backend/tests/`: pruebas unitarias e integración del backend.
- `supabase/migrations/`: fuente oficial del esquema y las políticas RLS.
- `supabase/tests/`: pruebas que demuestran qué puede y qué no puede hacer cada rol.
- `supabase/seed.sql`: equipos, cartas y preguntas de desarrollo.
- `frontend/public/js/api/`: comunicación del navegador con Supabase y FastAPI.

El esquema no se mantendrá solamente con cambios manuales en el panel de Supabase. Cada cambio permanente deberá quedar en una migración SQL dentro del repositorio.

## 6. Variables y secretos

### Frontend

El frontend podrá conocer:

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
BACKEND_API_URL=
```

La URL y la llave publicable están diseñadas para utilizarse en clientes. Su seguridad depende de RLS y de los permisos de la base.

Como el frontend actual no utiliza un empaquetador de JavaScript, un script de compilación generará `runtime-config.js` usando las variables de Netlify. El archivo generado no contendrá secretos.

### Backend

FastAPI utilizará:

```dotenv
ENVIRONMENT=development
SUPABASE_URL=
SUPABASE_SECRET_KEY=
DATABASE_URL=
FRONTEND_ORIGINS=http://localhost:8080,https://zona-diamante.netlify.app
```

Reglas:

- `SUPABASE_SECRET_KEY`, la llave `service_role` heredada y `DATABASE_URL` son secretos.
- Nunca se incluyen en HTML, JavaScript público, capturas o commits.
- `.env` queda ignorado por Git.
- `.env.example` sólo contiene nombres y valores de ejemplo.
- Los secretos de producción se guardan en el panel del proveedor correspondiente.

## 7. Modelo inicial de datos

### `profiles`

Extiende a `auth.users`; no guarda contraseñas.

```text
id uuid PK/FK -> auth.users.id
username text UNIQUE NOT NULL
display_name text
avatar_path text
points_balance integer NOT NULL DEFAULT 0 CHECK >= 0
created_at timestamptz
updated_at timestamptz
```

### `teams`

Sustituirá gradualmente a `equipos.json`.

```text
id bigint PK
slug text UNIQUE
name text
city text
zone text
history text
colors jsonb
details jsonb
is_active boolean
created_at timestamptz
updated_at timestamptz
```

Los campos consultados o filtrados con frecuencia serán columnas normales. `jsonb` se reservará para contenido editorial variable, no para ocultar relaciones importantes.

### `cards`

```text
id bigint PK
team_id bigint FK -> teams.id
slug text UNIQUE
name text
description text
image_path text
rarity text CHECK (...)
cost integer CHECK >= 0
is_active boolean
created_at timestamptz
updated_at timestamptz
```

### `user_cards`

Representa el inventario.

```text
user_id uuid FK -> profiles.id
card_id bigint FK -> cards.id
source text
unlocked_at timestamptz
PRIMARY KEY (user_id, card_id)
```

La clave compuesta evita que una carta repetida se inserte accidentalmente si el producto no admite duplicados.

### `activity_attempts`

Registra intentos de trivia, juego o AR.

```text
id uuid PK
user_id uuid FK -> profiles.id
activity_type text CHECK ('trivia', 'game', 'ar')
status text CHECK ('started', 'completed', 'rejected', 'expired')
score integer
started_at timestamptz
completed_at timestamptz
metadata jsonb
```

### `reward_events`

Es el libro contable de los cambios de puntos y cartas.

```text
id uuid PK
user_id uuid FK -> profiles.id
attempt_id uuid FK -> activity_attempts.id
event_type text
points_delta integer
card_id bigint NULL FK -> cards.id
idempotency_key text UNIQUE
metadata jsonb
created_at timestamptz
```

No se cambiará el saldo sin crear el evento correspondiente. La llave de idempotencia impide procesar dos veces la misma solicitud.

### Tablas opcionales posteriores

- `trivia_questions` y `trivia_answers` si las preguntas se administrarán desde la base.
- `ar_markers` si cada marcador tendrá una recompensa configurable.
- `app_settings` para costos o límites administrables.
- `user_roles` únicamente si aparecen administradores o editores reales.

No se crearán tablas especulativas antes de que una función del producto las necesite.

## 8. Seguridad y autorización

### Autenticación

Supabase Auth administrará:

- registro por correo y contraseña;
- confirmación de correo, si se habilita;
- inicio y cierre de sesión;
- recuperación de contraseña;
- emisión y renovación de tokens JWT.

Al registrarse un usuario, un trigger seguro creará su fila en `profiles`. La fotografía se subirá a un bucket `avatars` y `profiles.avatar_path` guardará sólo la ruta.

### RLS

Se habilitará RLS en toda tabla expuesta:

- cualquier visitante podrá leer equipos y cartas activos;
- un usuario autenticado podrá leer su propio perfil e inventario;
- un usuario sólo podrá actualizar los campos editables de su perfil;
- el navegador no podrá modificar `points_balance`;
- el navegador no podrá insertar directamente en `user_cards` ni `reward_events`;
- la escritura de recompensas quedará reservada al backend o a una función SQL controlada.

Además de las políticas, se revocarán privilegios no utilizados a `anon` y `authenticated`. Las políticas no sustituyen los `GRANT`/`REVOKE`.

### Validación en FastAPI

Las solicitudes protegidas enviarán:

```http
Authorization: Bearer <access-token>
```

FastAPI:

1. extraerá el token;
2. comprobará firma, emisor, audiencia y expiración mediante la configuración oficial de Supabase;
3. obtendrá el `sub`, que será el ID del usuario;
4. ignorará cualquier `user_id` enviado por el navegador;
5. aplicará reglas, límites e idempotencia;
6. ejecutará la operación atómica en PostgreSQL.

Para la primera versión se priorizará una validación sencilla y correcta. El uso de JWKS local con caché podrá añadirse después para reducir llamadas de red.

## 9. Lógica segura de puntos y recompensas

El frontend nunca realizará algo equivalente a:

```sql
update profiles set points_balance = points_balance + 100;
```

El flujo correcto será:

1. El frontend solicita iniciar una actividad.
2. FastAPI crea un `activity_attempts` con estado `started` y devuelve un ID/nonce.
3. El usuario completa la actividad.
4. El frontend envía el resultado y el ID del intento.
5. FastAPI comprueba usuario, estado, tiempo, puntuación y límites.
6. Una función SQL transaccional bloquea las filas necesarias.
7. La función crea `reward_events`, actualiza puntos y, si corresponde, inserta `user_cards`.
8. Todo confirma junto o todo se revierte.
9. Repetir la misma petición devuelve el resultado anterior y no duplica el premio.

Para trivia, el servidor no enviará la respuesta correcta en el mismo objeto visible antes de contestar. Para el minijuego y AR hay que aceptar que un cliente web siempre puede manipularse; usaremos intentos emitidos por el servidor, límites, tiempos razonables y eventos únicos para reducir abuso. Si en el futuro existieran premios con valor económico real, se necesitaría verificación más fuerte del juego y de los marcadores.

## 10. API inicial de FastAPI

Todas las rutas se versionarán bajo `/api/v1`.

```text
GET  /health
GET  /api/v1/me
PATCH /api/v1/me

POST /api/v1/attempts
GET  /api/v1/attempts/{attempt_id}
POST /api/v1/attempts/{attempt_id}/complete

GET  /api/v1/rewards
POST /api/v1/cards/draw
```

Los endpoints específicos de trivia, juego y AR se añadirán cuando esté definida su regla real. No se crearán tres implementaciones distintas si las tres pueden compartir el servicio de intentos y recompensas.

### Convenciones

- JSON consistente en respuestas y errores.
- Códigos HTTP correctos.
- Pydantic para validar toda entrada.
- IDs del usuario obtenidos del JWT.
- `Idempotency-Key` o una llave generada por intento en operaciones repetibles.
- Logs sin contraseñas, tokens ni secretos.
- Documentación automática de FastAPI deshabilitable o protegible en producción.

## 11. Dependencias del backend

Se reemplazó el `freeze` heredado por una lista de dependencias directas. La lista exacta crecerá durante la implementación, pero deberá cubrir:

- FastAPI y Uvicorn;
- configuración mediante `pydantic-settings`;
- cliente HTTP para autenticación o llamadas a Supabase;
- validación JWT y criptografía;
- acceso a PostgreSQL o cliente oficial de Supabase;
- pruebas con `pytest` y `httpx`.

Si FastAPI se conecta directamente a PostgreSQL, usaremos un driver moderno y un pool pequeño. Para un servidor persistente se elegirá conexión directa cuando el host soporte la red requerida; en caso contrario, el pooler de Supabase en modo sesión. El modo transacción se reservará para entornos serverless y requiere configuración específica del driver.

## 12. Fases de implementación

### Fase 0 — Limpieza y base del proyecto

Trabajo:

1. Mantener `requirements.txt` con sólo dependencias directas y utilizadas.
2. Crear el nuevo paquete `backend/app/`.
3. Mover el arranque a `backend/app/main.py`.
4. Añadir configuración por entorno.
5. Crear `/health`.
6. Restringir CORS a localhost y al dominio real de Netlify.
7. Añadir `.env.example`, pruebas mínimas y Dockerfile.

Criterio de término:

- el backend arranca localmente;
- `/health` responde;
- no quedan importaciones ni dependencias ajenas al backend actual;
- los secretos no aparecen en Git.

### Fase 1 — Proyecto Supabase y migraciones

Trabajo:

1. Crear los proyectos necesarios: producción y, si el ritmo lo justifica, staging.
2. Instalar Supabase CLI como dependencia de desarrollo.
3. Ejecutar `supabase init` en la raíz.
4. Crear migraciones para tablas, restricciones, funciones y RLS.
5. Crear `seed.sql` con los equipos y cartas actuales.
6. Añadir pruebas de permisos.
7. Vincular el proyecto remoto y aplicar migraciones.

Criterio de término:

- una base vacía puede reconstruirse sólo con migraciones y seed;
- las pruebas de RLS permiten y niegan los casos esperados;
- el esquema del panel coincide con Git.

### Fase 2 — Autenticación y perfiles

Trabajo:

1. Añadir `@supabase/supabase-js` al frontend.
2. Crear un cliente único.
3. Conectar `registro.html`.
4. Validar contraseña, correo, confirmación y errores.
5. Subir avatar a Storage.
6. Conectar `login.html`.
7. Mantener y observar la sesión.
8. Añadir cerrar sesión y recuperación de contraseña.
9. Proteger colección y perfil.

Criterio de término:

- una cuenta puede registrarse, confirmar su correo si aplica, entrar y salir;
- la sesión persiste al recargar;
- cada usuario ve sólo su perfil;
- los errores se muestran sin filtrar información sensible.

### Fase 3 — Integración segura de FastAPI

Trabajo:

1. Enviar el JWT del frontend a FastAPI.
2. Crear la dependencia `current_user`.
3. Implementar `/api/v1/me`.
4. Crear servicios de intentos y recompensas.
5. Implementar la función SQL transaccional.
6. Añadir idempotencia, límites y logs.
7. Probar token válido, expirado, ausente y manipulado.

Criterio de término:

- FastAPI identifica al usuario sin aceptar un ID arbitrario;
- ninguna ruta sensible funciona sin autenticación;
- una recompensa repetida no modifica dos veces puntos o inventario.

### Fase 4 — Colección y puntos reales

Trabajo:

1. Reemplazar la colección fija por datos de `cards` y `user_cards`.
2. Mostrar saldo desde `profiles`.
3. Implementar estados de carga, vacío y error.
4. Implementar el desbloqueo/gacha si sigue siendo parte del producto.
5. Aplicar costo y asignación en una sola transacción.

Criterio de término:

- dos usuarios pueden tener colecciones diferentes;
- una compra sin saldo falla sin cambios parciales;
- no aparecen cartas duplicadas involuntarias.

### Fase 5 — Trivia, juego y AR

Orden recomendado:

1. Trivia, porque sus resultados son más verificables.
2. Juego, cuando su mecánica final esté definida.
3. AR, definiendo qué marcador entrega qué recompensa y con qué frecuencia.

Cada integración usará el flujo común de intentos y recompensas. Antes de dar puntos se documentarán puntuación, límite diario, posibilidad de repetir y condiciones de victoria.

Criterio de término:

- recargar o repetir la petición no duplica premios;
- un intento perteneciente a otro usuario no puede cobrarse;
- los límites se aplican en el servidor, no sólo visualmente.

### Fase 6 — Despliegue

#### Supabase

1. Elegir una región cercana a la mayoría de usuarios.
2. Aplicar migraciones de producción.
3. Configurar URLs permitidas de Auth.
4. Crear buckets y políticas de Storage.
5. Revisar RLS, permisos, correo y copias de seguridad.

#### FastAPI

1. Crear el servicio en Render o Railway apuntando a `backend/`.
2. Instalar dependencias.
3. Ejecutar:

   ```text
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

4. Añadir variables secretas.
5. Configurar health check en `/health`.
6. Registrar el dominio de producción en CORS.
7. Usar HTTPS y revisar logs de arranque.

#### Netlify

1. Configurar las variables públicas.
2. Generar `runtime-config.js` durante el build.
3. Compilar Tailwind.
4. Desplegar `frontend/public/`.
5. Probar registro, login y llamadas al backend desde el dominio final.

Criterio de término:

- el flujo completo funciona desde un teléfono fuera de la red local;
- ninguna llave secreta aparece en los archivos servidos por Netlify;
- CORS acepta el sitio oficial y rechaza orígenes no autorizados.

### Fase 7 — Operación y mantenimiento

- Logs estructurados en FastAPI.
- Monitoreo de errores y latencia.
- Alertas de fallos del backend.
- Revisión periódica de intentos rechazados y abuso.
- Copias de seguridad de PostgreSQL.
- Estrategia separada para archivos de Storage, porque un respaldo de la base no incluye los objetos almacenados.
- Actualización controlada de dependencias.
- Migraciones revisadas antes de producción.

## 13. Pruebas mínimas

### Base de datos

- restricciones y claves foráneas;
- puntos nunca negativos;
- inventario sin duplicados;
- idempotencia de recompensas;
- políticas RLS para `anon`, `authenticated` y usuarios diferentes;
- transacción completa y rollback ante errores.

### Backend

- `/health`;
- autenticación válida e inválida;
- validación de payloads;
- permisos por usuario;
- límites de intentos;
- completar un intento dos veces;
- fallos de Supabase sin corromper el estado.

### Frontend

- registro e inicio de sesión;
- sesión al recargar;
- cierre de sesión;
- guardas de páginas;
- carga y error de colección;
- funcionamiento en navegador móvil y HTTPS;
- cámara/AR después de iniciar sesión.

### Producción

- prueba de humo después de cada despliegue;
- inspección de archivos públicos para confirmar que no hay secretos;
- verificación del dominio de Auth y CORS;
- prueba con dos usuarios para detectar fugas de datos.

## 14. Orden de trabajo inmediato

El siguiente bloque de trabajo debe limitarse a estas tareas:

1. Preservar y separar los cambios actuales del frontend.
2. Agregar únicamente las dependencias que requiera la integración con Supabase.
3. Crear la nueva estructura de FastAPI y `/health`.
4. Inicializar la carpeta `supabase/`.
5. Escribir la primera migración con `profiles`, `teams`, `cards`, `user_cards`, `activity_attempts` y `reward_events`.
6. Crear seed para los cuatro equipos y cuatro cartas.
7. Probar RLS localmente o en un proyecto de desarrollo.
8. Conectar solamente registro, login, avatar y sesión.

No se conectarán todavía trivia, juego ni AR. Primero debe quedar estable la identidad del usuario y la seguridad de los datos.

## 15. Decisiones que deberán definirse antes de las recompensas

La infraestructura puede comenzar sin estas respuestas, pero deberán resolverse antes de la Fase 5:

- cuántos puntos entrega cada actividad;
- si los puntos pueden gastarse y en qué;
- si una carta puede repetirse;
- si desbloquear una carta cuesta puntos;
- cuántas veces se puede premiar una actividad por día;
- qué constituye una victoria real en el minijuego;
- si el escaneo AR premia por marcador, equipo, evento o primera vez;
- si las preguntas de trivia vivirán en la base o continuarán versionadas en el frontend.

## 16. Referencias técnicas oficiales

- Supabase Database: https://supabase.com/docs/guides/database/overview
- Supabase Auth: https://supabase.com/docs/guides/auth
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase CLI: https://supabase.com/docs/guides/local-development/cli/getting-started
- Migraciones y ambientes: https://supabase.com/docs/guides/deployment/managing-environments
- Conexiones a PostgreSQL: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase Storage: https://supabase.com/docs/guides/storage/quickstart
