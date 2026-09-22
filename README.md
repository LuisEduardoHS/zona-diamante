# [Zona Diamante](https://zona-diamante.netlify.app/)

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
