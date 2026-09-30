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
