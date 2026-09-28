// Raíz de la carpeta pública, también al desplegar en una subcarpeta.
export const baseURL = new URL('../../', import.meta.url);
export const ruta = (path) => new URL(path, baseURL).href;

export const RUTAS = Object.freeze({
    inicio: 'index.html',
    trivia: 'pages/experiencias/trivia.html',
    juego: 'pages/experiencias/juego.html',
    camara: 'pages/experiencias/camara.html',
    informacion: 'pages/contenido/Informacion.html',
    ayuda: 'pages/contenido/Ayuda.html',
    equipo: 'pages/equipos/equipo.html',
    coleccion: 'pages/coleccion/coleccion.html',
    login: 'pages/auth/login.html',
    registro: 'pages/auth/registro.html',
    recuperar: 'pages/auth/recuperar.html',
    restablecer: 'pages/auth/restablecer.html',
    perfil: 'pages/auth/perfil.html'
});

export const paginas = Object.values(RUTAS);

export function rutaInterna(href) {
    const url = new URL(href, baseURL);
    if (url.origin !== baseURL.origin || !url.pathname.startsWith(baseURL.pathname)) return null;
    const archivo = url.pathname.slice(baseURL.pathname.length) || RUTAS.inicio;
    return paginas.includes(archivo) ? { url, archivo } : null;
}
