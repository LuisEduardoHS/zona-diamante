# Fichas de equipos

La página `public/pages/equipos/equipo.html?id=<slug>` comparte el catálogo con el carrusel. No cambia el header ni el menú inferior de la aplicación.

## Fuente de datos

`public/js/services/datos-equipos.js` expone:

- `obtenerEquipos()`: comparte la petición y su resultado entre vistas; los errores permiten reintentar.
- `normalizarEquipo(row)`: acepta el JSON actual o una fila de `public.teams` (`slug`, `name`, `city`, `zone`, `history`, `colors`, `details`). Resuelve todas las imágenes desde la raíz pública, incluidos estadio, mascota, MVP, galería y poster. Los slugs siguen siendo los identificadores de navegación.
- `configurarProveedorEquipos(cargar)`: recibe una función asíncrona que devuelve un array y limpia la caché. El proveedor predeterminado lee `data/equipos.json`.

Para conectar Supabase, configurar antes de montar el carrusel o el detalle, importando la misma URL de módulo versionada que ambos consumidores:

```js
import { configurarProveedorEquipos } from './services/datos-equipos.js?v=20261010-2';

configurarProveedorEquipos(async () => {
    const { data, error } = await supabase
        .from('teams')
        .select('slug,name,city,zone,history,colors,details,is_active')
        .eq('is_active', true);
    if (error) throw error;
    return data;
});
```

Se usa el cliente público existente y las políticas RLS de `teams`. No se necesita una credencial de servicio. Los campos nuevos de esta entrega pueden guardarse en `details`, que ya es JSONB. El seed actual todavía no incluye galería/video: trasladar esos campos desde el JSON antes de activar la base de datos. Una ficha sin contenido opcional muestra un estado vacío.

## Campos adicionales de detalles

- `galeria`: array de `{ imagen, alt }`; imágenes locales o URLs HTTP(S). Las cinco imágenes locales existentes de cada equipo están reutilizadas en el mosaico.
- `calendarioUrl`: enlace al sitio oficial para consultar actualizaciones.
- `calendario`: conserva el formato existente `{ oponente, fecha, hora }`. Para fechas reales usar `{ oponenteId, oponente, inicio }`, donde `inicio` es ISO 8601 con zona u offset. Se muestra fecha/hora de `America/Mexico_City`. No se inventaron fechas: los registros originales siguen pendientes de confirmación.
- `video`: `{ tipo: 'youtube', id, titulo, autor, poster, fuente }`. Alternativamente `{ tipo: 'archivo', src, titulo, poster, fuente }` para MP4/WebM de Storage o CDN. Las URLs se validan en la capa de datos; los IDs de YouTube se validan antes de crear el iframe.

Las estadísticas y el palmarés mantienen los valores del JSON recibido; no se presentan como resultados consultados en vivo.

## Medios y filtros

El video se carga únicamente al abrir el visor. El botón de reproducción y el botón Filtros abren el mismo diálogo; el segundo lleva el foco al selector. Los filtros son visuales mediante CSS, no modifican el archivo ni se guardan. Cerrar con X, Escape, el fondo o abandonar la sección destruye el reproductor, detiene su audio, restaura Original y desbloquea el scroll. YouTube depende de la disponibilidad y permisos del autor; cada video incluye enlace a la fuente. Los filtros se aplican al reproductor embebido completo; para filtrar exclusivamente los píxeles del video usar el formato `archivo`.

La galería permite ampliar, avanzar/retroceder y usar las flechas del teclado. Los diálogos nativos contienen el foco y lo devuelven al control de apertura.

## Fuentes de videos y enlaces

Consultadas el 10 de octubre de 2026; las imágenes son las ya guardadas en el repositorio.

- Sultanes: [sitio oficial](https://www.sultanes.com.mx/), [Javier Salazar, jonrón de tres carreras](https://www.youtube.com/watch?v=X31R6I2ZlGs), canal Sultanes de Monterrey. Video enlazado por el sitio oficial.
- Dorados: [ficha de LMB](https://lmb.com.mx/equipos/dorados), [Dorados vs. El Águila](https://www.youtube.com/watch?v=sVWf1ufRhEY), Hi Sports TV.
- Charros: [sitio oficial](https://www.charrosjalisco.com/), [Conociendo a Mateo Gil](https://www.youtube.com/watch?v=bFJSFN0xO30), canal Charros de Jalisco.
- Algodoneros: [sitio oficial](https://www.unionlaguna.mx/), [Algodoneros vs. Toros, playoffs juego 5](https://www.youtube.com/watch?v=MNSlGFjkYmQ), canal Algodoneros del Unión Laguna Oficial.

## Validación

`npm test` incluye `checks/equipo-detalle.test.mjs`, que comprueba las cuatro fichas, imágenes locales, calendario pendiente y fechado, adaptación de Supabase, escape de contenido, URLs, cambio de proveedor y recuperación de errores. `npm run build` compila CSS, cliente de Supabase y configuración pública.

Se sustituyeron los resúmenes de Claro Sports que mostraban «Este video no está disponible» en el iframe por publicaciones de los canales de los equipos. La disponibilidad de YouTube puede cambiar; se mantiene el enlace externo. Las transiciones respetan `prefers-reduced-motion`; el margen inferior está dentro del bloque de color para continuar detrás de la navegación.
