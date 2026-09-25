// Parte de la carpeta pública, también al desplegar en una subcarpeta.
export const baseURL = new URL('../', import.meta.url);
export const ruta = (path) => new URL(path, baseURL).href;
export const paginas = ['index.html', 'trivia.html', 'juego.html', 'Informacion.html', 'Ayuda.html', 'equipo.html', 'camara.html', 'pages/coleccion.html', 'login.html', 'registro.html'];

export function rutaInterna(href) {
    const url = new URL(href, baseURL);
    if (url.origin !== baseURL.origin || !url.pathname.startsWith(baseURL.pathname)) return null;
    const archivo = url.pathname.slice(baseURL.pathname.length) || 'index.html';
    return paginas.includes(archivo) ? { url, archivo } : null;
}
