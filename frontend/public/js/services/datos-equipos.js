import { ruta } from '../app/rutas.js';

const color = (value, fallback) => /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
export function urlEquipo(value) {
    if (!value || typeof value !== 'string') return '';
    try {
        const url = new URL(ruta(value));
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
}
const foto = value => ({ ...value, imagen: urlEquipo(value?.imagen) });

// Contrato único para el JSON local y las filas de public.teams de Supabase.
export function normalizarEquipo(row) {
    const detalles = row.detalles || row.details || {};
    const { imagenes: imagenesDetalle, ...contenido } = detalles;
    const colores = row.colores || row.colors || {};
    return {
        id: String(row.slug || row.id), nombre: row.nombre || row.name || 'Equipo',
        ciudad: row.ciudad || row.city || '',
        colores: { ...colores, primario: color(colores.primario, '#005C6C'), secundario: color(colores.secundario, '#f27b21') },
        imagenes: Object.fromEntries(Object.entries(row.imagenes || imagenesDetalle || {}).map(([key, value]) => [key, urlEquipo(value)])),
        detalles: {
            ...contenido,
            zona: detalles.zona || row.zone || '',
            historia: String(detalles.historia || row.history || '').replace(/<[^>]*>/g, ''),
            estadisticas: detalles.estadisticas || {},
            estadio: foto(detalles.estadio), mascota: foto(detalles.mascota), mvp: foto(detalles.mvp),
            palmares: Array.isArray(detalles.palmares) ? detalles.palmares : [],
            calendario: Array.isArray(detalles.calendario) ? detalles.calendario : [],
            calendarioUrl: urlEquipo(detalles.calendarioUrl),
            galeria: (Array.isArray(detalles.galeria) ? detalles.galeria : []).map(foto).filter(item => item.imagen),
            video: detalles.video ? { ...detalles.video, poster: urlEquipo(detalles.video.poster), src: urlEquipo(detalles.video.src), fuente: urlEquipo(detalles.video.fuente) } : null
        }
    };
}

async function proveedorLocal() {
    const response = await fetch(ruta('data/equipos.json?v=20261010-1'), { cache: 'no-cache' });
    if (!response.ok) throw new Error('No se pudieron cargar los equipos.');
    return response.json();
}
let proveedor = proveedorLocal;
let pendiente;
let version = 0;

// El proveedor devuelve un array de equipos o de filas public.teams.
// Cambiarlo invalida la caché sin acoplar las vistas a Supabase.
export function configurarProveedorEquipos(cargar = proveedorLocal) {
    if (typeof cargar !== 'function') throw new TypeError('El proveedor debe ser una función.');
    proveedor = cargar;
    pendiente = undefined;
    version++;
}
export function obtenerEquipos() {
    const actual = version;
    const cargar = proveedor;
    pendiente ??= Promise.resolve().then(() => cargar()).then(rows => {
        if (!Array.isArray(rows)) throw new TypeError('La fuente de equipos debe devolver una lista.');
        return rows.filter(row => row.is_active !== false).map(normalizarEquipo);
    }).catch(error => { if (version === actual) pendiente = undefined; throw error; });
    return pendiente;
}
