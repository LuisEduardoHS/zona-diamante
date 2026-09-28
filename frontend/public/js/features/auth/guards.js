import { RUTAS, ruta } from '../../app/rutas.js';

export function esErrorSesionRequerida(error) {
    const codigo = String(error?.code || '').toUpperCase();
    return ['AUTH_REQUIRED', 'SESSION_REQUIRED', 'NOT_AUTHENTICATED'].includes(codigo);
}

export function redirigirAlLogin(destino = location.href) {
    const login = new URL(ruta(RUTAS.login));
    const objetivo = new URL(destino, location.href);
    if (objetivo.origin === location.origin) login.searchParams.set('next', objetivo.pathname + objetivo.search + objetivo.hash);
    location.assign(login.href);
}
