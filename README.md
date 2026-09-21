# Zona Diamante

Zona Diamante es una experiencia web interactiva de beisbol. Permite explorar equipos, consultar informacion, jugar una trivia, participar en un juego y usar una experiencia de realidad aumentada para descubrir contenido de los equipos.

## Estructura

- `frontend/public/`: sitio web estatico, paginas HTML, imagenes, modelos, estilos y JavaScript del navegador.
- `frontend/src/css/input.css`: fuente de estilos Tailwind; `frontend/public/css/output.css` se genera al compilar.
- `frontend/public/js/components/`: componentes compartidos del header, menu lateral, navegacion inferior y carrusel.
- `frontend/public/data/equipos.json`: datos de equipos, colores, imagenes y contenido asociado.
- `backend/`: API minima construida con FastAPI para futuras integraciones.

## Tecnologias

- HTML, CSS y JavaScript modular en el frontend.
- Tailwind CSS 4 para estilos utilitarios y compilacion del CSS comun.
- Urbanist como tipografia principal.
- A-Frame y MindAR para la experiencia de realidad aumentada.
- Node.js para las herramientas de frontend.
- Python y FastAPI para el backend.

## Desarrollo

Desde `frontend/`:

```bash
npm install
npm run dev
```

Para generar el CSS optimizado:

```bash
npm run build
```

El sitio puede servirse directamente desde `frontend/public/` con un servidor estatico. La navegacion compartida mantiene el header y la barra inferior, y carga el contenido y los estilos de cada seccion sin reconstruir el documento completo.

## Pruebas locales

La carpeta `frontend/tests/` contiene pruebas y utilidades de validacion local. No forma parte del sitio publicado ni es importada por el frontend en ejecucion; se conserva solamente para desarrollo. Esta carpeta esta excluida del seguimiento futuro mediante `.gitignore`.

Los scripts `npm test`, `npm run preview:foto` y `npm run preview:navegacion` siguen apuntando a esas herramientas cuando se necesite ejecutar validaciones locales.

## Backend

Desde `backend/`, con el entorno de Python preparado:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

La API expone actualmente una ruta raiz de comprobacion y esta preparada para crecer con los servicios que necesite la experiencia.