# Zona Diamante

**Béisbol mexicano, realidad aumentada y una colección que crece con cada jugada.**

Zona Diamante es una aplicación web para conocer equipos del béisbol mexicano, consultar partidos de LMB y LMP, responder trivias y jugar para obtener puntos. Su escáner reconoce logos, muestra mascotas en 3D y permite reclamar cartas exclusivas para la colección de una cuenta.

La experiencia está diseñada para dispositivos móviles y también se adapta a escritorio. El frontend utiliza HTML y JavaScript modular; FastAPI y Supabase gestionan la autenticación, los datos y la entrega de recompensas.

**[Abrir la aplicación](https://zona-diamante.pages.dev)** · [Sitio alternativo](https://zona-diamante.netlify.app) · [Reportar un problema](https://github.com/LuisEduardoHS/zona-diamante/issues)

## Contenido

- [Funciones principales](#funciones-principales)
- [Arquitectura y tecnologías](#arquitectura-y-tecnologías)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Instalación local](#instalación-local)
- [Configuración](#configuración)
- [Desarrollo y pruebas](#desarrollo-y-pruebas)
- [Despliegue](#despliegue)
- [Documentación técnica](#documentación-técnica)
- [Contribuciones](#contribuciones)
- [Créditos y uso de recursos](#créditos-y-uso-de-recursos)

## Funciones principales

| Sección              | Qué puedes hacer                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Equipos**          | Explorar las fichas de Sultanes, Charros, Dorados y Algodoneros del Unión Laguna, con información, galerías, videos y filtros visuales predefinidos o manuales.           |
| **Calendario**       | Consultar LMB y LMP por fecha, equipo y estado. Las fichas comparten esta fuente y muestran el próximo partido pendiente cuando corresponde.                              |
| **Escáner AR**       | Reconocer logos con la cámara, visualizar mascotas en 3D, tomar fotografías y abrir la ficha del equipo detectado.                                                        |
| **Colección**        | Consultar cartas de jugadores, equipos y mascotas, adquirir cartas con puntos y reclamar las exclusivas del escáner con una cuenta.                                       |
| **Trivia**           | Resolver cinco preguntas por periodo, guardar el avance y recibir puntos según las respuestas. Se renueva a medianoche y mediodía en la zona configurada por el servidor. |
| **Juego de bateo**   | Jugar hasta acumular tres fallos. Tras reservar una partida con conexión, los lanzamientos se ejecutan en el dispositivo y el resultado se sincroniza al terminar.        |
| **Info y ayuda**     | Aprender reglas básicas, distinguir las ligas, explorar momentos históricos y consultar términos del juego.                                                               |
| **Cuenta y correos** | Registrarse, recuperar la contraseña, editar el perfil y administrar los avisos de nuevas trivias. Los correos tienen el diseño de Zona Diamante.                         |

El calendario público y el contenido informativo se pueden explorar sin iniciar sesión. Guardar cartas, puntos y progreso personal requiere una cuenta. El reconocimiento AR necesita permiso de cámara y un navegador compatible.

## Arquitectura y tecnologías

| Componente                | Tecnologías                                             | Responsabilidad                                                                             |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Frontend**              | HTML, módulos ES de JavaScript, Tailwind CSS 4, Lucide  | Interfaz adaptable, navegación entre secciones y consumo de servicios.                      |
| **Realidad aumentada**    | A-Frame, MindAR                                         | Reconocimiento de imágenes y visualización de modelos 3D en el navegador.                   |
| **Backend**               | Python, FastAPI, Pydantic, HTTPX                        | Validación de sesión, reglas del juego, recompensas, cartas, calendario y avisos de trivia. |
| **Datos y autenticación** | Supabase Auth, PostgreSQL, RLS y funciones SQL          | Identidad, perfiles, intentos, inventario, transacciones y permisos de acceso.              |
| **Archivos**              | Supabase Storage y recursos estáticos locales           | Avatares, imágenes del catálogo, fotografías, logos y modelos.                              |
| **Correo**                | Brevo API y SMTP; Supabase Cron, pg_net y Vault         | Avisos de trivia programados y correos de autenticación.                                    |
| **Herramientas**          | npm, Supabase CLI, pytest, Node Test Runner, Playwright | Compilación, migraciones y validación automática.                                           |

El navegador se autentica con Supabase y realiza las lecturas permitidas por RLS. Para operaciones de puntos, compras o recompensas, llama a FastAPI con el token de la sesión. El backend valida al usuario y ejecuta las operaciones mediante funciones de PostgreSQL; los reintentos utilizan identificadores estables para evitar premios duplicados.

El reconocimiento AR ocurre en el dispositivo: reclamar una mascota requiere una cuenta, pero no certifica presencia física ante un logo. El juego valida el resultado y sus límites en el servidor; su protocolo permite recuperar partidas y premios pendientes, sin constituir un sistema contra clientes modificados. Los alcances y límites de la sincronización se detallan en la [guía del juego](docs/juego-conexion.md).

Los partidos se consultan a través del backend usando **MLB Stats API**, sin una clave adicional para el calendario. La interfaz indica cuando los datos proceden de una copia guardada por un fallo del proveedor.

### Cómo se gestionan los correos

- **Avisos de trivia:** Supabase Cron solicita al backend procesar la cola cada cinco minutos. Se respetan el periodo vigente, la preferencia de cada cuenta y los registros de envío. Cada correo incluye una opción de baja.
- **Autenticación:** Supabase Auth envía directamente mediante Brevo SMTP. Incluye plantillas para confirmación, recuperación, invitaciones y otros eventos compatibles; disponer de una plantilla no activa por sí solo esa notificación.

La configuración de correo es opcional para comenzar a desarrollar. Un entorno nuevo mantiene los avisos de trivia desactivados por defecto.

## Estructura del repositorio

```text
zona-diamante/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # Endpoints de FastAPI
│   │   ├── core/              # Configuración, sesión y reglas compartidas
│   │   ├── db/                # Acceso a Supabase
│   │   ├── jobs/              # Herramientas de correo
│   │   ├── schemas/           # Contratos de entrada y salida
│   │   └── services/          # Lógica de negocio
│   ├── checks/                # Comprobaciones de integración y operación
│   ├── tests/                 # Pruebas de backend
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   ├── assets/            # Imágenes, modelos, iconos y medios
│   │   ├── data/              # Catálogos y configuración pública
│   │   ├── js/                # Navegación, componentes y funciones
│   │   └── pages/             # Pantallas de la aplicación
│   ├── src/css/               # Fuentes de Tailwind y estilos de componentes
│   ├── scripts/               # Compilación y validación
│   ├── checks/                # Pruebas versionadas y revisiones con navegador
│   ├── docs/
│   ├── .env.example
│   └── package.json
├── supabase/
│   ├── assets/                # Imágenes de cartas y manifiesto de fuentes
│   ├── migrations/            # Historial del esquema y permisos
│   ├── templates/             # Plantillas de correo de Auth
│   ├── tests/                 # Pruebas SQL
│   ├── config.toml
│   └── seed.sql               # Datos iniciales de desarrollo
├── docs/                     # Guías técnicas y evidencias
└── README.md
```

## Instalación local

Los siguientes comandos utilizan **PowerShell** y se ejecutan desde la raíz del repositorio, salvo donde se indica otra ubicación. En Linux o macOS, utiliza `python3` y la ruta `backend/venv/bin/python` para el entorno virtual.

### 1. Requisitos

- Git.
- Node.js 22 o posterior y npm.
- Python 3.12; es la versión utilizada en la imagen Docker del backend.
- Docker, si vas a ejecutar Supabase localmente.

También puedes usar un proyecto de Supabase de desarrollo ya configurado en lugar de iniciar los servicios locales. Las dependencias de npm de la raíz incluyen Supabase CLI.

### 2. Clonar e instalar dependencias

```powershell
git clone https://github.com/LuisEduardoHS/zona-diamante.git
cd zona-diamante

npm ci
npm --prefix frontend ci

python -m venv backend/venv
backend/venv/Scripts/python.exe -m pip install -r backend/requirements.txt
```

### 3. Preparar Supabase

Con Docker en ejecución, ajusta en `supabase/config.toml` los campos existentes de la sección `[auth]` para que los enlaces de autenticación regresen al frontend local:

```toml
[auth]
site_url = "http://localhost:5500"
additional_redirect_urls = [
  "http://localhost:5500/pages/auth/perfil.html",
  "http://localhost:5500/pages/auth/restablecer.html",
  "http://127.0.0.1:5500/pages/auth/perfil.html",
  "http://127.0.0.1:5500/pages/auth/restablecer.html"
]
```

Después inicia los servicios y consulta las claves y direcciones de tu entorno:

```powershell
npx supabase start
npx supabase status
```

Para reconstruir **una base local desechable**, aplicando las migraciones y los datos iniciales:

```powershell
npx supabase db reset --local
```

Este último comando elimina los datos de esa base local. No es un paso de actualización de producción.

Si usas Supabase alojado, prepara un proyecto de desarrollo con las migraciones del repositorio y configura en Auth las direcciones de retorno correspondientes. Los archivos de Storage se publican por separado de las migraciones; consulta la [guía de imágenes del catálogo](docs/imagenes-cartas.md) para disponer de copias en un proyecto propio.

### 4. Configurar las variables

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

En `frontend/.env`, configura los valores públicos del mismo proyecto de Supabase:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=<clave_publica_local>
BACKEND_API_URL=http://127.0.0.1:8000
```

En `backend/.env`, completa al menos:

```dotenv
ENVIRONMENT=development
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<clave_privada_local_de_servidor>
FRONTEND_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
TRIVIA_TIMEZONE=America/Monterrey
TRIVIA_EMAIL_ENABLED=false
```

Sustituye los marcadores por las claves obtenidas con `supabase status`. Si utilizas Supabase alojado, usa la URL y las claves de ese proyecto. Los archivos `.env` están excluidos de Git.

### 5. Compilar y ejecutar

Genera los archivos del frontend:

```powershell
npm --prefix frontend run build
```

Abre una terminal para FastAPI:

```powershell
cd backend
venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

En otra terminal, desde la raíz, sirve los archivos públicos:

```powershell
python -m http.server 5500 --directory frontend/public
```

| Servicio                          | Dirección local                |
| --------------------------------- | ------------------------------ |
| Aplicación                        | <http://localhost:5500>        |
| Estado del backend                | <http://127.0.0.1:8000/health> |
| Documentación interactiva del API | <http://127.0.0.1:8000/docs>   |
| Supabase Studio                   | <http://127.0.0.1:54323>       |
| Bandeja de correo local           | <http://127.0.0.1:54324>       |

Sirve el frontend por HTTP: abrir los HTML con `file://` impide el funcionamiento normal de los módulos y la navegación. Para probar la cámara desde un teléfono, utiliza HTTPS; acceder por la IP de la computadora mediante HTTP no equivale a `localhost`.

## Configuración

Los ejemplos completos están en [`frontend/.env.example`](frontend/.env.example) y [`backend/.env.example`](backend/.env.example).

| Variable                                           | Ubicación                      | Uso                                                                                                                 |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                     | Frontend y backend             | URL del proyecto que comparten ambos componentes.                                                                   |
| `SUPABASE_PUBLISHABLE_KEY`                         | Frontend                       | Clave pública del cliente. Su acceso a datos está sujeto a las políticas de la base.                                |
| `BACKEND_API_URL`                                  | Frontend                       | Dirección de FastAPI, incorporada al generar la configuración pública.                                              |
| `SUPABASE_SECRET_KEY`                              | Backend                        | Credencial privada de servicio para las operaciones del servidor.                                                   |
| `FRONTEND_ORIGINS`                                 | Backend                        | Orígenes autorizados por CORS, separados por comas.                                                                 |
| `TRIVIA_TIMEZONE`                                  | Backend                        | Zona horaria que determina los periodos de trivia.                                                                  |
| `DATABASE_URL`                                     | Herramientas de administración | Conexión PostgreSQL para herramientas que la requieran; no se publica en el navegador.                              |
| `TRIVIA_EMAIL_ENABLED`, `BREVO_API_KEY`, `EMAIL_*` | Backend                        | Activación, proveedor, remitente y direcciones de los avisos de trivia.                                             |
| `BREVO_SMTP_LOGIN`, `BREVO_SMTP_KEY`               | Configuración privada de Auth  | Credenciales usadas por la herramienta que configura SMTP en Supabase; son independientes de la clave API de Brevo. |

La compilación genera `runtime-config.js` con los valores públicos del frontend. **Nunca incluyas claves privadas, `service_role`, contraseñas SMTP ni conexiones PostgreSQL en ese archivo o en recursos públicos.** Los permisos de catálogo, inventario y recompensas están definidos en las migraciones.

La configuración local de Auth permite registro sin confirmación de correo por defecto. Si vas a probar ese flujo, activa `auth.email.enable_confirmations` en tu entorno local y revisa los mensajes en su bandeja de correo.

## Desarrollo y pruebas

### Frontend

```powershell
# Compilación completa
npm --prefix frontend run build

# Observación de cambios en Tailwind, después de la compilación inicial
npm --prefix frontend run dev

# Pruebas automatizadas de JavaScript
npm --prefix frontend test

# Validación del uso de la hoja de estilos compartida
npm --prefix frontend run check:styles
```

El build genera las reglas públicas del juego, el sprite local de Lucide, el CSS, el cliente de Supabase y la configuración del entorno. Los artefactos de compilación excluidos de Git deben generarse también durante el despliegue. Si cambias `frontend/.env`, vuelve a ejecutar `build:config` o el build completo.

Las pruebas versionadas están en `frontend/checks/`. Los archivos `*-browser.cjs` realizan comprobaciones adicionales con Playwright y un navegador; requieren una instalación de esas herramientas y el servidor correspondiente. Consulta las instrucciones de cada comprobación antes de ejecutarla.

### Backend

Desde `backend/`:

```powershell
venv/Scripts/python.exe -m pytest tests
```

La suite cubre contratos del API, autenticación, validaciones, reglas de juego, cartas, calendario y correo mediante dependencias simuladas. Las comprobaciones de `backend/checks/` que utilizan servicios reales son independientes; revisa sus parámetros y el entorno de destino antes de ejecutarlas.

### Base de datos

Con Supabase local en ejecución, desde la raíz:

```powershell
npx supabase test db
```

Las pruebas SQL se encuentran en `supabase/tests/`. Verifican el esquema, las políticas y las funciones de la economía y de AR. Las guías técnicas enlazadas abajo incluyen comprobaciones adicionales para los protocolos más recientes.

## Despliegue

El frontend se publica como sitio estático en Cloudflare Pages y Netlify; el backend se ejecuta en Render. Supabase administra los datos, la autenticación y Storage.

Para preparar otro entorno:

1. **Supabase:** aplica las migraciones revisadas, publica los archivos necesarios en Storage y configura Auth, sus URLs de retorno y las plantillas de correo.
2. **Backend:** instala `backend/requirements.txt`, configura sus variables privadas y ejecuta FastAPI. El [`Dockerfile`](backend/Dockerfile) admite el puerto de la variable `PORT`.
3. **Frontend:** configura sus tres variables públicas, instala las dependencias de `frontend/`, ejecuta `npm run build` desde esa carpeta y publica `frontend/public/`.
4. **Conexión:** añade el dominio del frontend a `FRONTEND_ORIGINS`, utiliza HTTPS y comprueba acceso, recuperación de contraseña y operaciones de cuenta.
5. **Correo opcional:** verifica el remitente, configura SMTP para Auth y sigue la guía de trivia para activar su cola y programador. Las migraciones por sí solas no habilitan el envío automático.

Las funciones nuevas pueden requerir cambios coordinados de base de datos, backend y frontend. Las migraciones se versionan en `supabase/migrations/`; las credenciales y la configuración privada del proveedor se mantienen fuera del repositorio.

## Documentación técnica

| Guía                                                      | Contenido                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Fichas de equipos](frontend/docs/fichas-equipos.md)      | Catálogo, medios, filtros y galerías.                                      |
| [Juego y conexión](docs/juego-conexion.md)                | Reserva, reproducción del resultado, persistencia y reintentos de premios. |
| [Trivia cada doce horas](docs/trivia-cada-12-horas.md)    | Periodos, persistencia y cambios del esquema.                              |
| [Imágenes de las cartas](docs/imagenes-cartas.md)         | Fuentes, manifiesto, Storage y publicación.                                |
| [Correos de trivia](docs/correos-trivia.md)               | Preferencias, baja, cola, Brevo y programador.                             |
| [Correos de autenticación](docs/correos-autenticacion.md) | Plantillas, SMTP y validación de los enlaces.                              |

`docs/` también conserva planes y evidencias de etapas anteriores. Esos documentos describen el estado de su implementación en ese momento; para el comportamiento actual, consulta el código, las migraciones y las guías de cada función.

## Contribuciones

Para proponer una mejora o corregir un problema:

1. Abre un issue con el comportamiento esperado, los pasos para reproducirlo y, si aplica, el navegador y tamaño de pantalla.
2. Realiza los cambios en una rama y conserva los estilos, componentes y contratos existentes.
3. Ejecuta las pruebas correspondientes y el build si modificas el frontend. Incluye una migración cuando cambie el esquema o sus permisos.
4. Abre un pull request con el propósito del cambio, la validación realizada y capturas si cambia la interfaz.

No incluyas credenciales, tokens, correos personales de usuarios ni datos de producción en issues, capturas o archivos de prueba.

## Créditos y uso de recursos

Desarrollado por [Luis Eduardo Hernández](https://github.com/LuisEduardoHS).

Los nombres de clubes, marcas, logos, fotografías y otros medios conservan los derechos de sus respectivos titulares. Su presencia en el proyecto no implica afiliación con las ligas o equipos ni una licencia de reutilización de esos recursos.

Las fuentes y atribuciones se conservan en:

- [Manifiesto de imágenes de cartas](supabase/assets/card-images/manifest.json).
- [Fuentes de las galerías](frontend/public/assets/img/equipos/galerias/fuentes.json).
- [Manifiesto de logos del calendario](frontend/public/data/match-logos.json).
- [Recursos del juego](frontend/public/assets/img/juego/bateador/README.md) y [recursos de trivia](frontend/public/assets/img/trivia/GENERATED-ASSETS.md).
- Las licencias incluidas en [`frontend/public/assets/icons/`](frontend/public/assets/icons/).

El repositorio no incluye actualmente un archivo `LICENSE` general. Las licencias de dependencias y recursos de terceros se conservan por separado; no debe interpretarse una licencia de un paquete como autorización sobre todos los contenidos del proyecto.
