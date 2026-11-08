# Zona Diamante

Zona Diamante es una experiencia web interactiva de beisbol. Permite explorar equipos, consultar informacion, jugar una trivia, participar en un juego y usar una experiencia de realidad aumentada para descubrir contenido de los equipos.

Producción del frontend:

```text
https://zona-diamante.netlify.app
```

Responsabilidades principales:

- **Frontend:** interfaz, navegación, sesión visual y llamadas permitidas desde el navegador.
- **Supabase Auth:** registro, login, sesiones, confirmación de correo y recuperación de contraseña.
- **Supabase PostgreSQL + RLS:** perfiles, equipos, cartas, intentos, recompensas y reglas de acceso.
- **Supabase Storage:** fotografías de perfil.
- **FastAPI:** operaciones sensibles como puntos, intentos, recompensas y desbloqueos.

## Tecnologias

- HTML, CSS y JavaScript modular en el frontend.
- Tailwind CSS 4 para estilos utilitarios y compilacion del CSS comun.
- A-Frame y MindAR para la experiencia de realidad aumentada.
- Node.js para las herramientas de frontend.
- Python y FastAPI para el backend.

## Estructura principal

```text
zona-diamante/
|-- backend/
|   |-- app/
|   |-- tests/
|   |-- requirements.txt
|   `-- Dockerfile
|
|-- frontend/
|   |-- public/
|   |   |-- index.html
|   |   |-- pages/
|   |   |-- js/
|   |   `-- vendor/
|   |-- scripts/
|   |-- src/
|   |-- .env.example
|   |-- package.json
|   `-- package-lock.json
|
|-- supabase/
|   |-- migrations/
|   |-- tests/
|   |-- seed.sql
|   `-- config.toml
|
|-- .gitignore
`-- README.md
```

---

# Ejecución local

Estas instrucciones están pensadas para **Windows + PowerShell**.

## 1. Requisitos

Instala antes de comenzar:

- Git
- Node.js y npm
- Python 3.13 o compatible con el backend
- Docker Desktop

El proyecto utiliza Supabase CLI desde las dependencias de Node del repositorio, por lo que no es necesario tener `supabase` agregado globalmente al `PATH`.

Puedes comprobar las herramientas con:

```powershell
git --version
node --version
npm --version
python --version
docker --version
```

## 2. Clonar el repositorio

```powershell
cd D:\projects
git clone https://github.com/LuisEduardoHS/zona-diamante.git
cd zona-diamante
```

Si ya tienes el repositorio:

```powershell
git switch main
git pull origin main
```

## 3. Instalar dependencias

### Dependencias de la raíz / Supabase CLI

Desde la raíz:

```powershell
npm install
```

Comprueba la CLI:

```powershell
npx supabase@2.118.0 --version
```

### Frontend

```powershell
npm --prefix frontend install
```

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

Si PowerShell bloquea la activación del entorno virtual, puedes usar temporalmente:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

---

# 4. Levantar Supabase local

Docker Desktop debe estar abierto.

Desde la raíz:

```powershell
npx supabase@2.118.0 start
```

Después revisa los servicios:

```powershell
npx supabase@2.118.0 status
```

Normalmente verás direcciones como:

```text
API:     http://127.0.0.1:54321
DB:      postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio:  http://127.0.0.1:54323
Mailpit: http://127.0.0.1:54324
```

Para reconstruir la base local desde las migraciones y el seed:

```powershell
npx supabase@2.118.0 db reset
```

> `db reset` afecta únicamente a la base local cuando se ejecuta contra el entorno local. No lo utilices contra producción.

## Supabase Studio local

```text
http://127.0.0.1:54323
```

## Correos locales de Auth

Los correos de confirmación y recuperación generados por Supabase local pueden revisarse en Mailpit:

```text
http://127.0.0.1:54324
```

---

# 5. Configurar variables del frontend

Copia el ejemplo:

```powershell
Copy-Item .\frontend\.env.example .\frontend\.env
```

Edita `frontend/.env`:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY_LOCAL>
BACKEND_API_URL=http://127.0.0.1:8000
```

Obtén la `SUPABASE_PUBLISHABLE_KEY` local con:

```powershell
npx supabase@2.118.0 status
```

`frontend/.env` está ignorado por Git.

Nunca coloques en el frontend:

```text
SUPABASE_SECRET_KEY
service_role
DATABASE_URL
```

---

# 6. Configurar variables del backend

Si no existe todavía `backend/.env`, copia el ejemplo del backend:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Para trabajar completamente contra Supabase local, la configuración tendrá una forma similar a:

```dotenv
ENVIRONMENT=development
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<SECRET_KEY_LOCAL>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
FRONTEND_ORIGINS=http://localhost:5500,https://zona-diamante.netlify.app
TRIVIA_TIMEZONE=America/Monterrey
```

Obtén los valores locales necesarios con:

```powershell
npx supabase@2.118.0 status
```

`backend/.env` debe mantenerse fuera de Git.

---

# 7. Generar el frontend

Antes de servir el frontend ejecuta:

```powershell
npm --prefix frontend run build
```

Actualmente este comando ejecuta tres tareas:

```text
build:css
   +
build:supabase
   +
build:config
```

Genera, entre otros:

```text
frontend/public/css/output.css
frontend/public/vendor/supabase.js
frontend/public/js/app/runtime-config.js
```

`supabase.js` y `runtime-config.js` son archivos generados y no se guardan en Git.

## Desarrollo de Tailwind en modo watch

Después del build inicial puedes dejar esta terminal abierta mientras modificas estilos:

```powershell
npm --prefix frontend run dev
```

Si cambias las variables de `frontend/.env`, vuelve a ejecutar:

```powershell
npm --prefix frontend run build:config
```

---

# 8. Ejecutar FastAPI

Abre una nueva terminal:

```powershell
cd D:\projects\zona-diamante\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend local:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

## Trivia diaria

La trivia usa la fecha oficial de `TRIVIA_TIMEZONE` y requiere un JWT de
Supabase en todos sus endpoints:

```text
GET  /api/v1/trivia/daily
POST /api/v1/trivia/daily/start
PUT  /api/v1/trivia/daily/answers/{question_id}
POST /api/v1/trivia/daily/submit
```

Cada selección se persiste al avanzar y `/daily/start` reanuda el único
intento del usuario para ese día. La evaluación, los 20 puntos por acierto y
la llave de idempotencia se calculan en backend; las respuestas correctas sólo
se incluyen en el review posterior a completar la trivia.

Para detenerlo usa:

```text
Ctrl + C
```

---

# 9. Servir el frontend

En otra terminal, desde la raíz:

```powershell
python -m http.server 5500 --directory frontend/public
```

Abre:

```text
http://localhost:5500
```

No abras los HTML directamente con `file://`, porque el proyecto utiliza módulos ES y navegación dinámica.

---

El sitio puede servirse directamente desde `frontend/public/` con un servidor estatico. La navegacion compartida mantiene el header y la barra inferior, y carga el contenido y los estilos de cada seccion sin reconstruir el documento completo.

## Calendario de partidos

El botón **Partidos** del inicio y del menú abre el calendario público de LMB y
LMP. Usa MLB Stats API sin API key ni sesión de usuario, a través de FastAPI:

```text
GET /api/v1/matches?league=lmb&date=2026-07-01
GET /api/v1/matches?league=lmp&date=2026-11-07
```

La fecha y los horarios corresponden a `America/Mexico_City`. Se pueden elegir
liga, día, equipo y estado; los filtros quedan en la URL para compartir la
jornada. Enero de LMP consulta la temporada que comenzó el año anterior.

El backend comparte una caché en memoria por proceso (máximo 128 entradas):
60 segundos para hoy o partidos en juego, 5 minutos para fechas futuras y
6 horas para fechas pasadas. Si el proveedor falla, puede devolver una jornada
guardada hace menos de 24 horas, marcada como desactualizada en la interfaz.
Sin datos disponibles se muestra un error con reintento. No se inventan partidos.
La vista vuelve a consultar cada minuto mientras está visible y muestra hoy o
partidos en curso. El proveedor puede tener retrasos en sus marcadores.

Los 30 logos de la temporada 2026 están guardados en
`frontend/public/assets/img/partidos/`; su procedencia está en
`frontend/public/data/match-logos.json`. La página usa iniciales como alternativa
para equipos sin logo. No hacen falta variables de entorno nuevas.

Para publicar esta sección deben desplegarse tanto el frontend como el backend
actualizado. El frontend utiliza el `BACKEND_API_URL` configurado durante el build.

Las fichas de equipos consultan el mismo calendario público y reutilizan sus
tarjetas, logos, estados y horarios. Cada ficha permite elegir LMB o LMP y cambiar
la fecha. Al abrirla o pulsar Hoy, `/api/v1/matches/next` busca el primer día con
partidos pendientes del equipo, desde hoy hasta 366 días adelante; incluye los
dos juegos si hay doble cartelera. Si aún no hay calendario publicado, lo indica.
El enlace al calendario general conserva liga, equipo y fecha del partido.
Charros usa su ID correspondiente a cada liga; la ficha de Unión Laguna no se
confunde con Guasave. Sultanes conserva su ID histórico de LMP para consultar
temporadas anteriores. Si el equipo no participa en la liga y temporada
seleccionadas, se indica y el enlace abre esa liga sin filtrar por otro club.
Los calendarios estáticos del catálogo no se muestran.
La correspondencia entre las cuatro fichas y los IDs de la liga se mantiene en
`frontend/public/js/features/equipos/calendario-equipo.js`.

### Iconos Lucide

El frontend usa `lucide-static` como dependencia de desarrollo. El comando
`npm --prefix frontend run build:icons` genera `frontend/public/assets/icons/lucide.svg` con
solo los iconos utilizados y copia su licencia junto al archivo. El build general
y el inicio de desarrollo también ejecutan este paso. No se carga una librería
de iconos externa en el navegador.

Para reutilizarlos en otra sección, añade el nombre a la lista de
`frontend/scripts/generate-icons.cjs`, regenera los iconos y usa un SVG con la
clase compartida `lucide-icon` y un `<use href="…/assets/icons/lucide.svg#nombre">`.
Los iconos decorativos deben tener `aria-hidden="true"`; los botones conservan
su texto o su etiqueta accesible.

### Cartas del escáner AR

Detectar un logo muestra un aviso que abre directamente la ficha del equipo.
El botón **Reclamar carta AR** guarda la mascota exclusiva en la colección de
la cuenta; si ya se posee, queda solamente **Ver 3D** a todo el ancho. Invitados
pueden usar AR y abrir la ficha, y reciben un enlace para iniciar sesión al
intentar guardar una carta. El confeti se ejecuta al reconocer cada equipo por
primera vez en la visita y al confirmar una carta nueva, respetando movimiento
reducido. Se cancela al perder el resultado, ocultar o abandonar la página.

`GET /api/v1/ar/mascots` y `POST /api/v1/ar/claim` requieren sesión. El POST sólo
acepta `team_slug`: el servidor resuelve usuario y carta, y reutiliza las RPC
`authorize_ar_mascot` y `grant_verified_ar_mascot` de la migración
`20261025000200_verified_ar_mascot_grants.sql`. La referencia estable
`ar-self-service:v1:<usuario>:<equipo>` permite reintentar sin duplicar la carta
ni conceder puntos. La migración `20261108000100_ar_catalog_row_lock_permissions.sql`
concede al rol del backend `UPDATE (is_active)` sobre equipos y cartas: PostgreSQL
requiere ese permiso para los bloqueos `FOR SHARE` de la entrega. Los roles del
navegador conservan el catálogo de sólo lectura. Sin esos permisos, consultar
la colección funciona pero reclamar devuelve un error.

La prueba transaccional `backend/checks/ar_claim_permissions.sql` verifica las
cuatro mascotas y sus reintentos usando permisos de catálogo restringidos,
comprueba que los puntos no cambian y revierte todos los datos de prueba.

La política actual permite reclamar la carta desde el escáner con una cuenta.
El reconocimiento ocurre en el dispositivo; este flujo no certifica presencia
física ni agrega un verificador de imágenes en el servidor. La autorización de
la carta se decide en backend y sus RPC siguen restringidas a `service_role`.
