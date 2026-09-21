import { ruta } from './rutas.js';

let pendiente;
export function obtenerEquipos() {
    // Comparte peticiones simultáneas y resultados entre inicio y detalle.
    pendiente ??= fetch(ruta('data/equipos.json')).then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar los equipos.');
        const equipos = await response.json();
        return equipos.map(equipo => ({ ...equipo, imagenes: Object.fromEntries(
            Object.entries(equipo.imagenes).map(([key, value]) => [key, ruta(value)])
        ) }));
    }).catch(error => { pendiente = undefined; throw error; });
    return pendiente;
}
